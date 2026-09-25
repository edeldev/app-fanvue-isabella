import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageCircle } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { FanProfileActions } from "@/components/lifecycle/fan-profile-actions";
import { lifecyclePresentation } from "@/domain/lifecycle/presentation";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
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
      subscriptions: { orderBy: { startedAt: "desc" }, take: 20 },
      purchases: { orderBy: { purchasedAt: "desc" }, take: 50 },
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
  const meta = lifecyclePresentation[fan.lifecycleStage];
  const activeEnrollment = fan.enrollments.find((item) => ["ACTIVE", "WAITING", "PAUSED"].includes(item.status));
  const timeline: TimelineItem[] = [
    ...fan.events.map((event) => ({ id: `event-${event.id}`, at: event.occurredAt, title: eventTitle(event.type), detail: payloadDetail(event.payload), tone: "bg-violet-400" })),
    ...fan.purchases.map((purchase) => ({ id: `purchase-${purchase.id}`, at: purchase.purchasedAt, title: purchase.amountMinor >= 0 ? "Compra registrada" : "Reverso registrado", detail: `${purchase.source} · ${money.format(purchase.amountMinor / 100)}`, tone: purchase.amountMinor >= 0 ? "bg-emerald-400" : "bg-rose-400" })),
    ...fan.subscriptions.map((subscription) => ({ id: `subscription-${subscription.id}`, at: subscription.startedAt, title: `Suscripción ${subscription.status.toLocaleLowerCase("es-MX")}`, detail: subscription.isFreeTrial ? "Prueba gratuita" : money.format((subscription.amountPaidMinor ?? subscription.priceMinor ?? 0) / 100), tone: "bg-sky-400" })),
    ...(fan.conversations[0]?.messages ?? []).map((message) => ({ id: `message-${message.id}`, at: message.sentAt, title: message.direction === "INBOUND" ? "Mensaje recibido" : "Mensaje enviado", detail: message.text?.slice(0, 180) || "Contenido multimedia", tone: message.direction === "INBOUND" ? "bg-fuchsia-400" : "bg-zinc-500" })),
    ...fan.automationLogs.map((log) => ({ id: `log-${log.id}`, at: log.occurredAt, title: "Automatización", detail: log.explanation, tone: log.level === "ERROR" ? "bg-rose-400" : "bg-amber-400" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 150);

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar/><div className="min-w-0 flex-1"><Topbar/>
    <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <Link href="/lifecycle" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft className="size-4"/>Volver a Lifecycle</Link>
      <header className="rounded-3xl border border-white/8 bg-gradient-to-br from-white/[.05] to-transparent p-6 md:p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4">{fan.avatarUrl ? <span className="size-16 shrink-0 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }}/> : <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-xl font-semibold text-violet-300">{(fan.displayName || fan.username || "F").slice(0, 2).toUpperCase()}</span>}<div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold text-white">{fan.displayName || fan.username || "Fan sin nombre"}</h1><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span>{fan.lifecycleOverride ? <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-500">Manual</span> : null}</div><p className="mt-1 text-sm text-zinc-500">@{fan.username || "sin-usuario"}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{fan.lifecycleReason || meta.description}</p></div></div><div className="flex gap-2"><Link href={`/messages?fan=${fan.id}`} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-400"><MessageCircle className="size-4"/>Abrir chat</Link>{fan.username ? <a href={`https://www.fanvue.com/${fan.username}`} target="_blank" rel="noreferrer" className="grid size-11 place-items-center rounded-xl border border-white/10 text-zinc-400 hover:text-white"><ExternalLink className="size-4"/></a> : null}</div></div></header>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="min-w-0 space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ["Ingresos", money.format(fan.totalSpentMinor / 100)],
          ["Compras", String(fan.purchases.filter((item) => item.amountMinor > 0 && !item.reversedAt).length)],
          ["Suscripción", fan.isSubscriber ? (fan.isFreeTrialSubscriber ? "Prueba activa" : "Activa") : fan.isExpiredSubscriber ? "Vencida" : "Sin suscripción"],
          ["Workflow", activeEnrollment?.workflow.name ?? "Sin flujo activo"],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="text-xs text-zinc-600">{label}</p><p className="mt-2 truncate font-semibold text-white" title={value}>{value}</p></div>)}</section>
        <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><div className="flex items-end justify-between gap-4"><div><h2 className="font-semibold text-white">Timeline unificado</h2><p className="mt-1 text-xs text-zinc-600">Mensajes, compras, suscripciones, etapas y automatizaciones.</p></div><span className="text-xs text-zinc-600">{timeline.length} eventos</span></div><div className="mt-5 space-y-0">{timeline.map((item) => <article key={item.id} className="relative grid grid-cols-[18px_1fr] gap-3 pb-5 last:pb-0"><div className="relative flex justify-center"><span className={`relative z-10 mt-1.5 size-2 rounded-full ${item.tone}`}/><span className="absolute bottom-0 top-3 w-px bg-white/8 last:hidden"/></div><div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-zinc-300">{item.title}</p><time className="text-[10px] text-zinc-700">{item.at.toLocaleString("es-MX")}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-600">{item.detail}</p></div></article>)}</div></section>
      </div><FanProfileActions fanId={fan.id} stage={fan.lifecycleStage} override={fan.lifecycleOverride} automationPaused={fan.automationPaused} tags={fan.tags.map(({ tag }) => tag)} notes={fan.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() }))}/></div>
    </main>
  </div></div>;
}

function eventTitle(type: string) { return ({ LIFECYCLE_STAGE_CHANGED: "Etapa del ciclo actualizada", FOLLOW_CREATED: "Comenzó a seguirte", POST_LIKED: "Le dio like a una publicación", POST_COMMENTED: "Comentó una publicación", FAN_AUTOMATION_PAUSED: "Automatización pausada", FAN_AUTOMATION_RESUMED: "Automatización reanudada" } as Record<string, string>)[type] ?? type.replaceAll("_", " ").toLocaleLowerCase("es-MX"); }
function payloadDetail(payload: unknown) { if (!payload || typeof payload !== "object" || Array.isArray(payload)) return ""; const value = payload as Record<string, unknown>; return [value.reason, value.commentText, value.acquisitionSource].find((item): item is string => typeof item === "string" && item.length > 0) ?? "Evento confirmado por Fanvue."; }

