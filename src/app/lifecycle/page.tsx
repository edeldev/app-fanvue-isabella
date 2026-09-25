import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ContactRound, Search } from "lucide-react";
import type { FanLifecycleStage, Prisma } from "@prisma/client";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { lifecyclePresentation, lifecycleStages } from "@/domain/lifecycle/presentation";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
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
    <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-400">Relación completa</p><h1 className="text-3xl font-semibold text-white">Fan Lifecycle</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Una vista operativa desde el primer follow hasta retención y reactivación. Los segmentos pueden coincidir: un fan puede ser comprador recurrente y tener su suscripción vencida al mismo tiempo.</p></div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">{[
        { value: "PAID", label: "Suscriptores de pago", description: "Acceso activo sin prueba gratuita", count: paidSubscribers, className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
        { value: "TRIAL", label: "Suscriptores de prueba", description: "Prueba gratuita activa", count: trialSubscribers, className: "border-sky-400/25 bg-sky-400/10 text-sky-300" },
        { value: "VIP", label: "VIP", description: "USD 100 o más de gasto confirmado", count: vipFans, className: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
      ].map((item) => <Link key={item.value} href={segment === item.value ? "/lifecycle" : `/lifecycle?segment=${item.value}`} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${segment === item.value ? item.className : "border-white/8 bg-white/[.025]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs text-zinc-600">{item.description}</p></div><p className="text-2xl font-semibold text-white">{item.count}</p></div></Link>)}</div>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{visibleLifecycleStages.map((item) => { const meta = lifecyclePresentation[item]; const active = stage === item; return <Link key={item} href={active ? "/lifecycle" : `/lifecycle?stage=${item}`} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${active ? meta.tone : "border-white/8 bg-white/[.025] hover:border-white/15"}`}><p className="text-2xl font-semibold text-white">{countMap.get(item) ?? 0}</p><p className="mt-1 text-sm font-medium">{meta.label}</p><p className="mt-2 text-xs leading-5 text-zinc-600">{meta.description}</p></Link>; })}</div>
      <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
        <div className="flex flex-col gap-4 border-b border-white/8 p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-white">Fans en seguimiento</h2><p className="mt-1 text-xs text-zinc-500">{filteredTotal ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredTotal)} de ${filteredTotal}` : "0 resultados"}</p></div><form className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111319] px-4 focus-within:border-violet-400/40"><Search className="size-4 text-zinc-600"/><input name="q" defaultValue={q} placeholder="Buscar fan…" className="h-11 bg-transparent text-sm outline-none placeholder:text-zinc-700"/>{stage ? <input type="hidden" name="stage" value={stage}/> : null}{segment ? <input type="hidden" name="segment" value={segment}/> : null}{status !== "active" ? <input type="hidden" name="status" value={status}/> : null}</form></div><div className="flex flex-wrap gap-2">{([{ value: "active", label: "Activos" }, { value: "archived", label: `Archivados (${archivedTotal})` }, { value: "all", label: "Todos" }] as const).map((item) => <Link key={item.value} href={lifecycleHref({ stage, segment, q, status: item.value, page: 1 })} className={`rounded-lg border px-3 py-1.5 text-xs transition ${status === item.value ? "border-violet-400/35 bg-violet-400/15 text-violet-200" : "border-white/8 text-zinc-500 hover:text-zinc-300"}`}>{item.label}</Link>)}</div></div>
        {fans.length ? <div className="divide-y divide-white/6">{fans.map((fan) => {
          const duplicateUsername = Boolean(fan.username && duplicateUsernames.has(fan.username));
          const badges = tableBadges(fan, firstBuyerSet.has(fan.id), repeatBuyerSet.has(fan.id));
          return <Link key={fan.id} href={`/lifecycle/fans/${fan.id}`} className="grid gap-4 p-5 transition hover:bg-white/[.025] md:grid-cols-[minmax(220px,.9fr)_minmax(260px,1.15fr)_minmax(240px,1fr)_auto] md:items-center"><div className="min-w-0"><p className="truncate font-medium text-zinc-100">{fan.displayName || fan.username || "Fan sin nombre"}</p><p className="mt-1 truncate text-xs text-zinc-600">@{fan.username || "sin-usuario"}</p>{duplicateUsername ? <p className="mt-1 text-[10px] text-amber-400/80">Mismo @usuario · Fanvue ID …{fan.fanvueUserId.slice(-8)}</p> : null}</div><div className="flex flex-wrap gap-1.5">{badges.map((badge) => <span key={badge.label} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${badge.tone}`}>{badge.label}</span>)}</div><div><p className="line-clamp-2 text-xs leading-5 text-zinc-500">{tableSummary(fan, firstBuyerSet.has(fan.id), repeatBuyerSet.has(fan.id))}</p><div className="mt-2 flex flex-wrap gap-1">{fan.tags.map(({ tag }) => <span key={tag.id} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{tag.name}</span>)}</div></div><div className="flex items-center gap-4"><span className="whitespace-nowrap text-sm font-semibold text-white">{money.format(fan.totalSpentMinor / 100)}</span><ArrowRight className="size-4 text-zinc-600"/></div></Link>;
        })}</div> : <div className="grid min-h-60 place-items-center text-center"><div><ContactRound className="mx-auto mb-3 size-7 text-zinc-700"/><p className="text-sm text-zinc-400">No hay fans con estos filtros.</p></div></div>}
        {filteredTotal > PAGE_SIZE ? <nav aria-label="Paginación de fans" className="flex items-center justify-between border-t border-white/8 p-4"><Link aria-disabled={page <= 1} href={pageHref(Math.max(1, page - 1))} className={`rounded-lg border px-3 py-2 text-xs ${page <= 1 ? "pointer-events-none border-white/5 text-zinc-700" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>Anterior</Link><span className="text-xs text-zinc-500">Página {Math.min(page, totalPages)} de {totalPages}</span><Link aria-disabled={page >= totalPages} href={pageHref(Math.min(totalPages, page + 1))} className={`rounded-lg border px-3 py-2 text-xs ${page >= totalPages ? "pointer-events-none border-white/5 text-zinc-700" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>Siguiente</Link></nav> : null}
      </section>
    </main>
  </div></div>;
}

type TableFan = {
  id: string;
  fanvueUserId: string;
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isNonRenewingSubscriber: boolean;
  isExpiredSubscriber: boolean;
  isArchived: boolean;
  totalSpentMinor: number;
  memories: { id: string }[];
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
    else if (fan.isNonRenewingSubscriber) badges.push({ label: "No renovará", tone: "border-orange-400/25 bg-orange-400/10 text-orange-300" });
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
  if (fan.isSubscriber) details.push(fan.isFreeTrialSubscriber ? "tiene una prueba activa" : fan.isNonRenewingSubscriber ? "mantiene acceso, pero no renovará" : "tiene suscripción de pago activa");
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
