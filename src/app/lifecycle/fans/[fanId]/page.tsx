import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CircleDollarSign, ExternalLink, GitBranch, MessageCircle, RefreshCw, ShoppingBag, UserCheck } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { FanProfileActions } from "@/components/lifecycle/fan-profile-actions";
import { FanMemoryCard } from "@/components/lifecycle/fan-memory-card";
import { NextBestActionCard } from "@/components/lifecycle/next-best-action-card";
import { calculateNextBestAction } from "@/domain/ai/next-best-action";
import { deriveFanMemory } from "@/domain/ai/fan-memory";
import { buildPurchaseBreakdown, revenueCategoryLabels, type RevenueCategory } from "@/domain/fans/purchase-breakdown";
import { lifecyclePresentation } from "@/domain/lifecycle/presentation";
import { describeSubscriptionPeriod } from "@/domain/lifecycle/subscription-period";
import { renewalLabel } from "@/domain/lifecycle/renewal-signals";
import { detectIntimateContentConsent } from "@/domain/fans/intimate-consent-detection";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
const subscriptionDate = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeZone: "America/Monterrey",
});
type TimelineItem = { id: string; at: Date; title: string; detail: string; tone: string };

export default async function FanLifecycleProfile({ params }: { params: Promise<{ fanId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) notFound();
  const { fanId } = await params;
  const fan = await prisma.fan.findFirst({
    where: { id: fanId, creatorId },
    include: {
      tags: { include: { tag: true }, orderBy: { assignedAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, take: 30 },
      memories: { orderBy: [{ confirmedAt: "desc" }, { observedAt: "desc" }], take: 50 },
      subscriptions: { orderBy: { startedAt: "desc" }, take: 20 },
      purchases: { orderBy: { purchasedAt: "desc" } },
      events: { orderBy: { occurredAt: "desc" }, take: 100 },
      conversations: { take: 1, include: { messages: { orderBy: { sentAt: "desc" }, take: 100 } } },
      enrollments: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: { workflow: { select: { name: true } }, currentStep: { select: { name: true } } },
      },
      automationLogs: { orderBy: { occurredAt: "desc" }, take: 100 },
    },
  });
  if (!fan) notFound();
  const consentEvidenceMessages = await prisma.message.findMany({
    where: { creatorId, direction: "INBOUND", deletedAt: null, text: { not: null }, conversation: { fanId } },
    orderBy: { sentAt: "desc" },
    take: 25,
    select: { id: true, text: true, sentAt: true },
  });
  const meta = lifecyclePresentation[fan.lifecycleStage];
  const activeEnrollment = fan.enrollments.find((item) => ["ACTIVE", "WAITING", "PAUSED"].includes(item.status));
  const subscription = fan.isSubscriber ? describeSubscriptionPeriod(fan.subscriptions) : null;
  const messages = fan.conversations[0]?.messages ?? [];
  const verifiedConsentMessageId = fan.intimateContentOptInSource?.startsWith("fanvue-message:")
    ? fan.intimateContentOptInSource.slice("fanvue-message:".length)
    : null;
  const verifiedConsentMessage = verifiedConsentMessageId
    ? messages.find((message) => message.id === verifiedConsentMessageId) ?? null
    : null;
  const priorConsentContext = verifiedConsentMessage
    ? messages
        .filter((message) => message.direction === "OUTBOUND" && message.sentAt < verifiedConsentMessage.sentAt)
        .slice(0, 3)
    : [];
  const consentDetection = verifiedConsentMessage
    ? detectIntimateContentConsent(
        messages.map((message) => ({ id: message.id, role: message.direction === "INBOUND" ? "fan" as const : "creator" as const, text: message.text, sentAt: message.sentAt })),
        verifiedConsentMessage.id,
      )
    : null;
  const automaticMessageIds = new Set(fan.automationLogs.flatMap((log) => {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) return [];
    const messageId = (log.metadata as Record<string, unknown>).fanvueMessageId;
    return typeof messageId === "string" ? [messageId] : [];
  }));
  const inboundMessages = messages.filter((message) => message.direction === "INBOUND");
  const outboundMessages = messages.filter((message) => message.direction === "OUTBOUND");
  const activeMemories = fan.memories.filter((memory) => memory.status === "ACTIVE");
  const dismissedMemoryKeys = new Set(fan.memories.filter((memory) => memory.status === "DISMISSED").map((memory) => `${memory.category}:${memory.key}`));
  const detectedMemories = activeMemories.length ? [] : deriveFanMemory(inboundMessages.map((message) => ({ id: message.id, text: message.text, sentAt: message.sentAt })))
    .filter((memory) => !dismissedMemoryKeys.has(`${memory.category}:${memory.key}`));
  const effectiveMemories = activeMemories.length ? activeMemories : detectedMemories;
  const nextAction = calculateNextBestAction({
    name: fan.displayName?.split(/\s+/)[0] || fan.username || "Hola",
    lifecycleStage: fan.lifecycleStage,
    isFollower: fan.isFollower,
    isSubscriber: fan.isSubscriber,
    isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
    totalSpentMinor: fan.totalSpentMinor,
    inboundMessages: inboundMessages.length,
    lastInboundAt: inboundMessages[0]?.sentAt ?? null,
    lastOutboundAt: outboundMessages[0]?.sentAt ?? null,
    hasActiveWorkflow: Boolean(activeEnrollment),
    memories: effectiveMemories,
  });
  const revenueBreakdown = buildPurchaseBreakdown(fan.purchases);
  const revenueCategories: RevenueCategory[] = ["subscriptions", "messagePpv", "feedPpv", "tips", "other"];
  const timeline: TimelineItem[] = [
    ...fan.events.map((event) => ({ id: `event-${event.id}`, at: event.occurredAt, title: eventTitle(event.type), detail: payloadDetail(event.payload), tone: "bg-violet-400" })),
    ...fan.purchases.map((purchase) => ({ id: `purchase-${purchase.id}`, at: purchase.purchasedAt, title: purchase.amountMinor >= 0 ? "Compra registrada" : "Reverso registrado", detail: `${purchase.source} · ${money.format(purchase.amountMinor / 100)}`, tone: purchase.amountMinor >= 0 ? "bg-emerald-400" : "bg-rose-400" })),
    ...fan.subscriptions.map((subscription) => ({ id: `subscription-${subscription.id}`, at: subscription.startedAt, title: `Suscripción ${subscription.status.toLocaleLowerCase("es-MX")}`, detail: subscription.isFreeTrial ? "Prueba gratuita" : money.format((subscription.amountPaidMinor ?? subscription.priceMinor ?? 0) / 100), tone: "bg-sky-400" })),
    ...(fan.conversations[0]?.messages ?? []).map((message) => ({ id: `message-${message.id}`, at: message.sentAt, title: message.direction === "INBOUND" ? "Mensaje recibido" : "Mensaje enviado", detail: message.text?.slice(0, 180) || "Contenido multimedia", tone: message.direction === "INBOUND" ? "bg-fuchsia-400" : "bg-zinc-500" })),
    ...fan.automationLogs.map((log) => ({ id: `log-${log.id}`, at: log.occurredAt, title: "Automatización", detail: log.explanation, tone: log.level === "ERROR" ? "bg-rose-400" : "bg-amber-400" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 150);

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar/><div className="min-w-0 flex-1"><Topbar/>
    <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
      <Link href="/lifecycle" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] px-3 py-2 text-xs font-medium text-zinc-500 transition hover:border-violet-400/20 hover:bg-violet-400/[.05] hover:text-white"><ArrowLeft className="size-4"/>Volver a Lifecycle</Link>
      <header className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-[radial-gradient(circle_at_10%_0%,rgba(139,92,246,.2),transparent_34%),linear-gradient(135deg,#191b26,#111319)] p-5 shadow-[0_0_55px_rgba(124,58,237,.08)] sm:p-7 md:p-8"><div aria-hidden className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/80 to-transparent shadow-[0_0_18px_rgba(196,181,253,.65)]"/><div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-start gap-4 sm:items-center">{fan.avatarUrl ? <span className="size-16 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-white/15 shadow-[0_0_28px_rgba(139,92,246,.12)] sm:size-20" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }}/> : <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-violet-400/15 bg-violet-500/15 text-xl font-semibold text-violet-300 sm:size-20">{(fan.displayName || fan.username || "F").slice(0, 2).toUpperCase()}</span>}<div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-violet-300/70">Perfil de relación</p><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-semibold text-white sm:text-3xl">{fan.displayName || fan.username || "Fan sin nombre"}</h1><span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${meta.tone}`}>{meta.label}</span>{fan.lifecycleOverride ? <span className="rounded-full border border-white/10 bg-white/[.035] px-2 py-1 text-[9px] text-zinc-500">Etapa manual</span> : null}</div><p className="mt-1 text-sm text-zinc-500">@{fan.username || "sin-usuario"}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{fan.lifecycleReason || meta.description}</p></div></div><div className="flex gap-2"><Link href={`/messages?fan=${fan.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,.22)] transition hover:bg-violet-400 lg:flex-none"><MessageCircle className="size-4"/>Abrir chat</Link>{fan.username ? <a href={`https://www.fanvue.com/${fan.username}`} target="_blank" rel="noreferrer" aria-label="Abrir perfil en Fanvue" className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[.025] text-zinc-400 transition hover:border-violet-400/25 hover:text-white"><ExternalLink className="size-4"/></a> : null}</div></div></header>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="min-w-0 space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ProfileMetric icon={CircleDollarSign} label="Ingresos" value={money.format(fan.totalSpentMinor / 100)} tone="emerald"/><ProfileMetric icon={ShoppingBag} label="Compras" value={String(fan.purchases.filter((item) => item.amountMinor > 0 && !item.reversedAt).length)} tone="amber"/><ProfileMetric icon={UserCheck} label="Suscripción" value={fan.isSubscriber ? (fan.isFreeTrialSubscriber ? "Prueba activa" : "Activa") : fan.isExpiredSubscriber ? "Vencida" : "Sin suscripción"} tone="sky"/><ProfileMetric icon={GitBranch} label="Workflow" value={activeEnrollment?.workflow.name ?? "Sin flujo activo"} tone="violet"/></section>
        {subscription ? <section className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-400/[.07] to-transparent p-5"><div aria-hidden className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent"/><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-400/15 bg-violet-500/15 text-violet-300"><CalendarDays className="size-5"/></span><div><h2 className="font-semibold text-white">Periodo de {fan.isFreeTrialSubscriber ? "prueba gratuita" : "suscripción de pago"}</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{subscription.stale ? "El último periodo registrado ya terminó; Fanvue aún no confirma una nueva fecha." : subscription.pending ? "Periodo reportado por Fanvue, pendiente de confirmación." : "Fechas sincronizadas desde Fanvue."}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SubscriptionDateCard label="Primera suscripción" value={fan.firstSubscribedAt ? subscriptionDate.format(fan.firstSubscribedAt) : "No disponible"}/><SubscriptionDateCard label="Inicio del periodo actual" value={subscription.period ? subscriptionDate.format(subscription.period.startedAt) : "No disponible"}/><SubscriptionDateCard label={subscription.endLabel} value={subscription.endValue ? subscriptionDate.format(subscription.endValue) : "Sin fecha confirmada"}/><SubscriptionDateCard label="Renovación automática" value={renewalLabel(fan)} icon={fan.isAutoRenewingSubscriber && !fan.renewalSignalsConflict ? <RefreshCw className="size-3.5 text-emerald-300"/> : undefined}/></div></section> : null}
        <section className="rounded-3xl border border-white/8 bg-white/[.025] p-5 shadow-[0_18px_45px_rgba(0,0,0,.12)]"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300"><CircleDollarSign className="size-4"/></span><div><h2 className="font-semibold text-white">Origen de los ingresos</h2><p className="mt-1 text-xs text-zinc-600">Qué compra realmente este fan y qué categoría sostiene su valor.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{revenueCategories.map((category) => { const item = revenueBreakdown[category]; return <div key={category} className="rounded-xl border border-white/7 bg-black/10 p-3 transition hover:border-emerald-400/15 hover:bg-emerald-400/[.025]"><p className="text-[10px] font-medium text-zinc-500">{revenueCategoryLabels[category]}</p><p className="mt-2 text-sm font-semibold text-white">{money.format(item.amountMinor / 100)}</p><p className="mt-1 text-[10px] text-zinc-700">{item.count} {item.count === 1 ? "pago" : "pagos"}</p></div>; })}</div></section>
        <NextBestActionCard fanId={fan.id} action={nextAction}/>
        <section className="rounded-3xl border border-white/8 bg-white/[.025] p-5 shadow-[0_18px_45px_rgba(0,0,0,.12)]"><div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-violet-400/70">Historial completo</p><h2 className="mt-1 font-semibold text-white">Timeline unificado</h2><p className="mt-1 text-xs text-zinc-600">Mensajes, compras, suscripciones, etapas y automatizaciones.</p></div><span className="rounded-full border border-white/8 bg-black/15 px-2.5 py-1 text-[10px] text-zinc-600">{timeline.length} eventos</span></div><div className="mt-5 max-h-[680px] space-y-0 overflow-y-auto overscroll-contain pr-2">{timeline.map((item) => <article key={item.id} className="relative grid grid-cols-[18px_1fr] gap-3 pb-5 last:pb-0"><div className="relative flex justify-center"><span className={`relative z-10 mt-1.5 size-2 rounded-full shadow-[0_0_10px_currentColor] ${item.tone}`}/><span className="absolute bottom-0 top-3 w-px bg-white/8 last:hidden"/></div><div className="rounded-xl border border-white/0 px-2 pb-2 transition hover:border-white/6 hover:bg-white/[.02]"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-zinc-300">{item.title}</p><time className="text-[10px] text-zinc-700">{item.at.toLocaleString("es-MX")}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-600">{item.detail}</p></div></article>)}</div></section>
      </div><div className="space-y-6"><FanMemoryCard fanId={fan.id} memories={effectiveMemories.map((memory) => ({ ...memory, id: "id" in memory ? memory.id : null, observedAt: memory.observedAt.toISOString() }))}/><FanProfileActions fanId={fan.id} stage={fan.lifecycleStage} override={fan.lifecycleOverride} automationPaused={fan.automationPaused} doNotMessage={fan.doNotMessage} doNotMessageReason={fan.doNotMessageReason} intimateContentOptIn={fan.intimateContentOptIn} intimateContentOptInAt={fan.intimateContentOptInAt?.toISOString() ?? null} intimateContentOptInSource={fan.intimateContentOptInSource} verifiedConsentEvidence={verifiedConsentMessage?.text?.trim() ? { fanMessage: { text: verifiedConsentMessage.text, sentAt: verifiedConsentMessage.sentAt.toISOString() }, reason: consentDetection?.reason ?? "Consentimiento vinculado a este mensaje.", context: priorConsentContext.flatMap((message) => message.text?.trim() ? [{ text: message.text, sentAt: message.sentAt.toISOString(), automatic: automaticMessageIds.has(message.fanvueMessageId) }] : []) } : null} consentEvidenceMessages={consentEvidenceMessages.flatMap((message) => message.text?.trim() ? [{ id: message.id, text: message.text, sentAt: message.sentAt.toISOString() }] : [])} hasActiveWorkflow={Boolean(activeEnrollment)} tags={fan.tags.map(({ tag }) => tag)} notes={fan.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() }))}/></div></div>
    </main>
  </div></div>;
}

function ProfileMetric({ icon: Icon, label, value, tone }: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "sky" | "violet";
}) {
  const styles = {
    emerald: "border-emerald-400/15 bg-emerald-400/[.035] text-emerald-300 shadow-emerald-500/10",
    amber: "border-amber-400/15 bg-amber-400/[.035] text-amber-300 shadow-amber-500/10",
    sky: "border-sky-400/15 bg-sky-400/[.035] text-sky-300 shadow-sky-500/10",
    violet: "border-violet-400/15 bg-violet-400/[.035] text-violet-300 shadow-violet-500/10",
  }[tone];
  return <article className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 shadow-[0_0_25px_var(--tw-shadow-color)] ${styles}`}><div aria-hidden className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-current/70 to-transparent"/><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-zinc-600">{label}</p><p className="mt-2 truncate text-sm font-semibold text-white" title={value}>{value}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-current/15 bg-current/[.06]"><Icon className="size-4"/></span></div></article>;
}

function SubscriptionDateCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl border border-white/7 bg-black/15 p-3"><p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-200">{icon}{value}</p></div>;
}

function eventTitle(type: string) { return ({ LIFECYCLE_STAGE_CHANGED: "Etapa del ciclo actualizada", FOLLOW_CREATED: "Comenzó a seguirte", POST_LIKED: "Le dio like a una publicación", POST_COMMENTED: "Comentó una publicación", FAN_AUTOMATION_PAUSED: "Automatización pausada", FAN_AUTOMATION_RESUMED: "Automatización reanudada", FAN_DO_NOT_MESSAGE_ENABLED: "Protección de contacto activada", FAN_DO_NOT_MESSAGE_DISABLED: "Protección de contacto retirada" } as Record<string, string>)[type] ?? type.replaceAll("_", " ").toLocaleLowerCase("es-MX"); }
function payloadDetail(payload: unknown) { if (!payload || typeof payload !== "object" || Array.isArray(payload)) return ""; const value = payload as Record<string, unknown>; return [value.reason, value.commentText, value.acquisitionSource].find((item): item is string => typeof item === "string" && item.length > 0) ?? "Evento confirmado por Fanvue."; }
