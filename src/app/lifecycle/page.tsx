import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ArrowUpRight, CalendarDays, ContactRound, Crown, FlaskConical, Search, Sparkles, UserCheck } from "lucide-react";
import type { FanLifecycleStage, Prisma } from "@prisma/client";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { lifecyclePresentation, lifecycleStages } from "@/domain/lifecycle/presentation";
import { describeSubscriptionPeriod } from "@/domain/lifecycle/subscription-period";
import { renewalLabel } from "@/domain/lifecycle/renewal-signals";
import { buildPurchaseBreakdown, primaryRevenueCategory, revenueCategoryLabels } from "@/domain/fans/purchase-breakdown";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
const subscriptionDate = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeZone: "America/Monterrey",
});
type AudienceSegment = "PAID" | "TRIAL" | "VIP";
type ContactStatus = "active" | "archived" | "all";
type SearchParams = Promise<{ stage?: string | string[]; segment?: string | string[]; q?: string | string[]; status?: string | string[]; page?: string | string[] }>;
const PAGE_SIZE = 25;

export default async function LifecyclePage({ searchParams }: { searchParams: SearchParams }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const params = await searchParams;
  const rawStage = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const rawSegment = Array.isArray(params.segment) ? params.segment[0] : params.segment;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const stage = lifecycleStages.includes(rawStage as FanLifecycleStage) ? rawStage as FanLifecycleStage : null;
  const segment = (["PAID", "TRIAL", "VIP"] as const).includes(rawSegment as AudienceSegment) ? rawSegment as AudienceSegment : null;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 80) ?? "";
  const status: ContactStatus = rawStatus === "archived" || rawStatus === "all" ? rawStatus : "active";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const segmentWhere: Prisma.FanWhereInput = segment === "PAID"
    ? { isSubscriber: true, isFreeTrialSubscriber: false }
    : segment === "TRIAL"
      ? { isSubscriber: true, isFreeTrialSubscriber: true }
      : segment === "VIP"
        ? { totalSpentMinor: { gte: 10_000 } }
        : {};
  const ppvPurchases = creatorId ? await prisma.purchase.groupBy({
    by: ["fanId"],
    where: { creatorId, amountMinor: { gt: 0 }, reversedAt: null, source: { in: ["message", "post"] } },
    _count: { _all: true },
  }) : [];
  const firstBuyerIds = ppvPurchases.filter((item) => item._count._all === 1).flatMap((item) => item.fanId ? [item.fanId] : []);
  const repeatBuyerIds = ppvPurchases.filter((item) => item._count._all >= 2).flatMap((item) => item.fanId ? [item.fanId] : []);
  const stageWhere: Prisma.FanWhereInput = stage === "FOLLOWER"
    ? { isFollower: true }
    : stage === "ENGAGED"
      ? { memories: { some: { status: "ACTIVE", category: "PURCHASE_INTENT" } } }
      : stage === "FIRST_BUYER"
        ? { id: { in: firstBuyerIds } }
        : stage === "REPEAT_BUYER"
          ? { id: { in: repeatBuyerIds } }
          : stage === "HIGH_VALUE"
            ? { totalSpentMinor: { gte: 5_000, lt: 10_000 } }
            : stage
              ? { lifecycleStage: stage }
              : {};
  const cardWhere: Record<FanLifecycleStage, Prisma.FanWhereInput> = {
    FOLLOWER: { isFollower: true },
    NEW_SUBSCRIBER: { lifecycleStage: "NEW_SUBSCRIBER" },
    ENGAGED: { memories: { some: { status: "ACTIVE", category: "PURCHASE_INTENT" } } },
    FIRST_BUYER: { id: { in: firstBuyerIds } },
    REPEAT_BUYER: { id: { in: repeatBuyerIds } },
    HIGH_VALUE: { totalSpentMinor: { gte: 5_000, lt: 10_000 } },
    VIP: { totalSpentMinor: { gte: 10_000 } },
    NON_RENEWING: { isSubscriber: true, isNonRenewingSubscriber: true },
    EXPIRED: { isSubscriber: false, isExpiredSubscriber: true },
    REACTIVATED: { lifecycleStage: "REACTIVATED" },
  };
  const visibleLifecycleStages = lifecycleStages.filter((item) => item !== "NEW_SUBSCRIBER" && item !== "VIP");
  const baseWhere = creatorId ? { creatorId, isCreatorAccount: false, isArchived: false } : null;
  const visibilityWhere: Prisma.FanWhereInput = status === "active" ? { isArchived: false } : status === "archived" ? { isArchived: true } : {};
  const filteredWhere: Prisma.FanWhereInput | null = creatorId ? {
    creatorId,
    isCreatorAccount: false,
    ...visibilityWhere,
    ...stageWhere,
    ...segmentWhere,
    ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}),
  } : null;
  const [cardCounts, paidSubscribers, trialSubscribers, vipFans, fans, usernameGroups, filteredTotal, archivedTotal] = creatorId && baseWhere && filteredWhere ? await Promise.all([
    Promise.all(visibleLifecycleStages.map((item) => prisma.fan.count({ where: { ...baseWhere, ...cardWhere[item] } }))),
    prisma.fan.count({ where: { creatorId, isCreatorAccount: false, isArchived: false, isSubscriber: true, isFreeTrialSubscriber: false } }),
    prisma.fan.count({ where: { creatorId, isCreatorAccount: false, isArchived: false, isSubscriber: true, isFreeTrialSubscriber: true } }),
    prisma.fan.count({ where: { creatorId, isCreatorAccount: false, isArchived: false, totalSpentMinor: { gte: 10_000 } } }),
    prisma.fan.findMany({
      where: filteredWhere,
      orderBy: [{ isArchived: "asc" }, { lifecycleChangedAt: "desc" }, { lastActivityAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        tags: { include: { tag: true } },
        memories: { where: { status: "ACTIVE", category: "PURCHASE_INTENT" }, select: { id: true } },
        purchases: { where: { amountMinor: { gt: 0 }, reversedAt: null }, select: { amountMinor: true, source: true, externalMessageId: true, externalPostId: true, reversedAt: true } },
        subscriptions: {
          orderBy: { startedAt: "desc" },
          take: 5,
          select: { id: true, startedAt: true, currentPeriodEndsAt: true, autoRenewalEnabled: true, status: true },
        },
      },
    }),
    prisma.fan.groupBy({
      by: ["username"],
      where: { creatorId, isCreatorAccount: false, username: { not: null } },
      _count: { _all: true },
    }),
    prisma.fan.count({ where: filteredWhere }),
    prisma.fan.count({ where: { creatorId, isCreatorAccount: false, isArchived: true } }),
  ]) : [visibleLifecycleStages.map(() => 0), 0, 0, 0, [], [], 0, 0];
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const pageHref = (nextPage: number) => lifecycleHref({ stage, segment, q, status, page: nextPage });
  const countMap = new Map(visibleLifecycleStages.map((item, index) => [item, cardCounts[index] ?? 0]));
  const duplicateUsernames = new Set(usernameGroups.filter((item) => item._count._all > 1).flatMap((item) => item.username ? [item.username] : []));
  const firstBuyerSet = new Set(firstBuyerIds);
  const repeatBuyerSet = new Set(repeatBuyerIds);

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar />
    <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
      <div className="relative mb-5 overflow-hidden rounded-3xl border border-violet-400/15 bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,.2),transparent_34%),linear-gradient(135deg,#191b26,#111319)] p-5 shadow-[0_0_55px_rgba(124,58,237,.08)] sm:p-7">
        <div aria-hidden className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/80 to-transparent shadow-[0_0_18px_rgba(196,181,253,.65)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5"><div className="max-w-3xl"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-violet-300">Relationship intelligence</p><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Fan Lifecycle</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Entiende en qué momento está cada relación, qué evidencia respalda su etapa y dónde existe la siguiente oportunidad comercial.</p><p className="mt-2 text-[11px] text-zinc-600">Los segmentos pueden coincidir: un comprador recurrente también puede tener una suscripción vencida.</p></div><Link href="/intelligence" className="group inline-flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-400/[.08] px-4 py-3 text-xs font-semibold text-violet-100 shadow-[0_0_25px_rgba(139,92,246,.09)] transition hover:border-violet-300/40 hover:bg-violet-400/[.13]"><Sparkles className="size-4" />Priorizar con IA<ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link></div>
      </div>

      <section className="mb-5"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">Valor y acceso</p><h2 className="mt-1 text-base font-semibold text-white">Segmentos prioritarios</h2></div>{segment ? <Link href="/lifecycle" className="text-[11px] text-violet-300 hover:text-violet-200">Limpiar segmento</Link> : null}</div><div className="grid gap-3 md:grid-cols-3">{[
        { value: "PAID", label: "Suscriptores de pago", description: "Acceso activo sin prueba gratuita", count: paidSubscribers, icon: UserCheck, tone: "emerald" as const },
        { value: "TRIAL", label: "Suscriptores de prueba", description: "Prueba gratuita activa", count: trialSubscribers, icon: FlaskConical, tone: "sky" as const },
        { value: "VIP", label: "VIP", description: "USD 100 o más de gasto confirmado", count: vipFans, icon: Crown, tone: "amber" as const },
      ].map((item) => <SegmentCard key={item.value} href={segment === item.value ? "/lifecycle" : `/lifecycle?segment=${item.value}`} active={segment === item.value} {...item} />)}</div></section>

      <section className="mb-7 rounded-3xl border border-white/8 bg-white/[.02] p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">Mapa del ciclo</p><h2 className="mt-1 text-base font-semibold text-white">Etapa actual y oportunidad</h2></div><p className="max-w-lg text-[11px] leading-5 text-zinc-600">Selecciona una etapa para concentrarte solo en los fans que requieren esa estrategia.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{visibleLifecycleStages.map((item) => { const meta = lifecyclePresentation[item]; const active = stage === item; return <Link key={item} href={active ? "/lifecycle" : `/lifecycle?stage=${item}`} className={`group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 ${active ? meta.tone : "border-white/8 bg-black/10 hover:border-violet-400/18"}`}><div aria-hidden className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${active ? "via-current/80" : "via-white/0 group-hover:via-violet-300/55"} to-transparent`} /><div className="flex items-start justify-between gap-3"><div><p className="text-2xl font-semibold text-white">{countMap.get(item) ?? 0}</p><p className="mt-1 text-sm font-medium">{meta.label}</p></div><ArrowUpRight className="size-4 text-zinc-700 transition group-hover:text-violet-300" /></div><p className="mt-3 text-xs leading-5 text-zinc-600">{meta.description}</p></Link>; })}</div></section>

      <section className="overflow-hidden rounded-3xl border border-white/8 bg-white/[.025] shadow-[0_20px_55px_rgba(0,0,0,.16)]">
        <div className="flex flex-col gap-4 border-b border-white/8 bg-[linear-gradient(135deg,rgba(139,92,246,.035),transparent_45%)] p-4 sm:p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-violet-400/70">Relaciones en seguimiento</p><h2 className="mt-1 font-semibold text-white">Fans que coinciden con tu estrategia</h2><p className="mt-1 text-xs text-zinc-500">{filteredTotal ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredTotal)} de ${filteredTotal}` : "0 resultados"}</p></div><form className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111319] px-4 transition focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-400/8 md:w-80"><Search className="size-4 shrink-0 text-zinc-600"/><input name="q" defaultValue={q} placeholder="Buscar fan…" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-700"/>{stage ? <input type="hidden" name="stage" value={stage}/> : null}{segment ? <input type="hidden" name="segment" value={segment}/> : null}{status !== "active" ? <input type="hidden" name="status" value={status}/> : null}</form></div><div className="flex flex-wrap items-center gap-2">{([{ value: "active", label: "Activos" }, { value: "archived", label: `Archivados (${archivedTotal})` }, { value: "all", label: "Todos" }] as const).map((item) => <Link key={item.value} href={lifecycleHref({ stage, segment, q, status: item.value, page: 1 })} className={`rounded-lg border px-3 py-1.5 text-xs transition ${status === item.value ? "border-violet-400/35 bg-violet-400/15 text-violet-100 shadow-[0_0_16px_rgba(139,92,246,.08)]" : "border-white/8 text-zinc-500 hover:border-white/15 hover:text-zinc-300"}`}>{item.label}</Link>)}{stage || segment || q ? <Link href="/lifecycle" className="ml-auto text-[10px] text-zinc-600 hover:text-violet-300">Limpiar todos los filtros</Link> : null}</div></div>
        {fans.length ? <div className="divide-y divide-white/6">{fans.map((fan) => {
          const duplicateUsername = Boolean(fan.username && duplicateUsernames.has(fan.username));
          const badges = tableBadges(fan, firstBuyerSet.has(fan.id), repeatBuyerSet.has(fan.id));
          const primaryCategory = primaryRevenueCategory(buildPurchaseBreakdown(fan.purchases));
          const subscription = fan.isSubscriber ? describeSubscriptionPeriod(fan.subscriptions) : null;
          return <Link key={fan.id} href={`/lifecycle/fans/${fan.id}`} className="group grid gap-4 p-4 transition hover:bg-violet-400/[.025] sm:p-5 md:grid-cols-[minmax(220px,.9fr)_minmax(260px,1.15fr)_minmax(240px,1fr)_auto] md:items-center"><div className="flex min-w-0 items-center gap-3">{fan.avatarUrl ? <span className="size-11 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-white/10" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }} /> : <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/8 bg-white/5 text-xs font-semibold text-zinc-500">{fanInitials(fan.displayName, fan.username)}</span>}<div className="min-w-0"><p className="truncate font-medium text-zinc-100">{fan.displayName || fan.username || "Fan sin nombre"}</p><p className="mt-1 truncate text-xs text-zinc-600">@{fan.username || "sin-usuario"}</p>{duplicateUsername ? <p className="mt-1 text-[10px] text-amber-400/80">Mismo @usuario · ID …{fan.fanvueUserId.slice(-8)}</p> : null}</div></div><div><div className="flex flex-wrap gap-1.5">{badges.map((badge) => <span key={badge.label} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${badge.tone}`}>{badge.label}</span>)}</div>{subscription ? <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-violet-400/10 bg-violet-400/[.045] px-3 py-2"><CalendarDays className="mt-0.5 size-3.5 shrink-0 text-violet-300"/><div className="text-[10px] leading-4 text-zinc-500">{fan.firstSubscribedAt ? <><span className="text-zinc-300">Primera suscripción:</span> {subscriptionDate.format(fan.firstSubscribedAt)}<span className="mx-1.5 text-zinc-700">·</span></> : null}{subscription.period ? <><span className="text-zinc-300">Periodo actual:</span> {subscriptionDate.format(subscription.period.startedAt)}<span className="mx-1.5 text-zinc-700">·</span></> : null}<span className="text-zinc-300">{subscription.endLabel}:</span> {subscription.endValue ? subscriptionDate.format(subscription.endValue) : "sin fecha confirmada"}{subscription.stale ? <span className="ml-1 text-amber-300">· último periodo registrado ya terminó</span> : subscription.pending ? <span className="ml-1 text-amber-300">· periodo pendiente de confirmación</span> : null}<span className="mt-1 block">Renovación: {renewalLabel(fan)}</span></div></div> : null}</div><div><p className="line-clamp-2 text-xs leading-5 text-zinc-500">{tableSummary(fan, firstBuyerSet.has(fan.id), repeatBuyerSet.has(fan.id))}</p><div className="mt-2 flex flex-wrap gap-1">{fan.tags.map(({ tag }) => <span key={tag.id} className="rounded-md border border-white/6 bg-white/[.035] px-2 py-0.5 text-[10px] text-zinc-500">{tag.name}</span>)}</div></div><div className="flex items-center justify-between gap-4 md:justify-end"><span className="text-left md:text-right"><span className="block whitespace-nowrap text-sm font-semibold text-white">{money.format(fan.totalSpentMinor / 100)}</span>{primaryCategory ? <span className="mt-1 block whitespace-nowrap text-[10px] text-violet-300/70">Principal: {revenueCategoryLabels[primaryCategory]}</span> : null}</span><span className="grid size-9 place-items-center rounded-xl border border-white/0 text-zinc-700 transition group-hover:border-violet-400/15 group-hover:bg-violet-400/[.06] group-hover:text-violet-300"><ArrowRight className="size-4"/></span></div></Link>;
        })}</div> : <div className="grid min-h-60 place-items-center text-center"><div><ContactRound className="mx-auto mb-3 size-7 text-zinc-700"/><p className="text-sm text-zinc-400">No hay fans con estos filtros.</p></div></div>}
        {filteredTotal > PAGE_SIZE ? <nav aria-label="Paginación de fans" className="flex items-center justify-between border-t border-white/8 p-4"><Link aria-disabled={page <= 1} href={pageHref(Math.max(1, page - 1))} className={`rounded-lg border px-3 py-2 text-xs ${page <= 1 ? "pointer-events-none border-white/5 text-zinc-700" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>Anterior</Link><span className="text-xs text-zinc-500">Página {Math.min(page, totalPages)} de {totalPages}</span><Link aria-disabled={page >= totalPages} href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-lg border px-3 py-2 text-xs ${page >= totalPages ? "pointer-events-none border-white/5 text-zinc-700" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>Siguiente</Link></nav> : null}
      </section>
    </main>
  </div></div>;
}

function SegmentCard({ href, active, icon: Icon, label, description, count, tone }: {
  href: string;
  active: boolean;
  icon: typeof UserCheck;
  label: string;
  description: string;
  count: number;
  tone: "emerald" | "sky" | "amber";
}) {
  const styles = {
    emerald: "border-emerald-400/20 bg-emerald-400/[.045] text-emerald-300 shadow-emerald-500/10",
    sky: "border-sky-400/20 bg-sky-400/[.045] text-sky-300 shadow-sky-500/10",
    amber: "border-amber-400/20 bg-amber-400/[.045] text-amber-300 shadow-amber-500/10",
  }[tone];
  return <Link href={href} className={`group relative overflow-hidden rounded-2xl border p-4 shadow-[0_0_28px_var(--tw-shadow-color)] transition hover:-translate-y-0.5 ${active ? styles : "border-white/8 bg-white/[.025] text-zinc-500 hover:border-violet-400/18"}`}>
    <div aria-hidden className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${active ? "via-current/75" : "via-white/0 group-hover:via-violet-300/55"} to-transparent`} />
    <div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl border border-current/15 bg-current/[.06]"><Icon className="size-4" /></span><span className="text-2xl font-semibold text-white">{count}</span></div><p className="mt-4 text-sm font-semibold text-white">{label}</p><p className="mt-1 text-xs text-zinc-600">{description}</p>
  </Link>;
}

function fanInitials(displayName: string | null, username: string | null) {
  return (displayName || username || "F").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type TableFan = {
  id: string;
  fanvueUserId: string;
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isNonRenewingSubscriber: boolean;
  isAutoRenewingSubscriber: boolean;
  renewalSignalsConflict: boolean;
  firstSubscribedAt: Date | null;
  isExpiredSubscriber: boolean;
  isArchived: boolean;
  totalSpentMinor: number;
  memories: { id: string }[];
  purchases: Array<{ amountMinor: number; source: string; externalMessageId: string | null; externalPostId: string | null; reversedAt: Date | null }>;
  subscriptions: Array<{ id: string; startedAt: Date; currentPeriodEndsAt: Date | null; autoRenewalEnabled: boolean | null; status: string }>;
};

type TableBadge = { label: string; tone: string };

function tableBadges(fan: TableFan, isFirstBuyer: boolean, isRepeatBuyer: boolean): TableBadge[] {
  const badges: TableBadge[] = [];
  if (fan.isArchived) badges.push({ label: "Ausente de Fanvue", tone: "border-zinc-400/20 bg-zinc-400/[.08] text-zinc-400" });
  if (fan.totalSpentMinor >= 10_000) badges.push({ label: "VIP · USD 100+", tone: "border-amber-400/25 bg-amber-400/10 text-amber-300" });
  else if (fan.totalSpentMinor >= 5_000) badges.push({ label: "Alto valor", tone: "border-yellow-400/20 bg-yellow-400/[.08] text-yellow-300" });
  if (isRepeatBuyer) badges.push({ label: "PPV recurrente", tone: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" });
  else if (isFirstBuyer) badges.push({ label: "Primera compra PPV", tone: "border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300" });
  if (fan.memories.length) badges.push({ label: "Intención de compra", tone: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300" });
  if (fan.isSubscriber) {
    if (fan.isFreeTrialSubscriber) badges.push({ label: "Prueba activa", tone: "border-sky-400/25 bg-sky-400/10 text-sky-300" });
    else badges.push({ label: "Suscriptor de pago", tone: "border-violet-400/25 bg-violet-400/10 text-violet-300" });
  } else if (fan.isExpiredSubscriber) badges.push({ label: "Suscripción vencida", tone: "border-rose-400/25 bg-rose-400/10 text-rose-300" });
  if (fan.isFollower) badges.push({ label: "Seguidor", tone: "border-cyan-400/20 bg-cyan-400/[.08] text-cyan-300" });
  if (!badges.length) badges.push({ label: "Contacto", tone: "border-white/10 bg-white/[.04] text-zinc-500" });
  return badges;
}

function tableSummary(fan: TableFan, isFirstBuyer: boolean, isRepeatBuyer: boolean) {
  if (fan.isArchived) return "No apareció en la última sincronización completa de Fanvue; conservamos su historial sin contarlo como contacto activo.";
  const details: string[] = [];
  if (isRepeatBuyer) details.push("Compró contenido PPV al menos dos veces");
  else if (isFirstBuyer) details.push("Realizó su primera compra PPV");
  if (fan.memories.length) details.push("expresó intención comercial");
  if (fan.isSubscriber) details.push(fan.isFreeTrialSubscriber ? "tiene una prueba activa" : "tiene suscripción de pago activa");
  else if (fan.isExpiredSubscriber) details.push("su suscripción está vencida");
  if (fan.isFollower) details.push("sigue la cuenta");
  return details.length ? `${details.join(" · ")}.` : "Contacto sincronizado sin una relación activa confirmada.";
}

function lifecycleHref({ stage, segment, q, status, page }: { stage: FanLifecycleStage | null; segment: AudienceSegment | null; q: string; status: ContactStatus; page: number }) {
  const params = new URLSearchParams();
  if (stage) params.set("stage", stage);
  if (segment) params.set("segment", segment);
  if (q) params.set("q", q);
  if (status !== "active") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/lifecycle?${query}` : "/lifecycle";
}
