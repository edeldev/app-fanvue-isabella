import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Activity, ArrowUpRight, ChevronLeft, ChevronRight, Crown, Filter, Search, UserCheck, Users, X } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { FanPresenceReconciler } from "@/components/fan-presence-reconciler";
import { StatusTooltips } from "@/components/status-tooltips";
import { buildFansWhere, fanFilterOptions, isConfirmedVip, isFanOnlineNow, parseFanFilter, type FanFilter } from "@/domain/fans/filters";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const PAGE_SIZE = 20;
const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
const numberFormat = new Intl.NumberFormat("es-MX");
const subscriptionLabels = {
  ACTIVE: { label: "Activo", description: "Tiene una suscripción activa." },
  CANCEL_AT_PERIOD_END: { label: "Cancela al vencer", description: "Sigue activo hasta terminar el periodo pagado, pero no renovará." },
  PENDING: { label: "Pendiente de precio", description: "Debe aceptar el nuevo precio. Si tiene renovación automática, continúa renovando al precio anterior mientras tanto." },
  PAUSED: { label: "Pausado", description: "La suscripción está temporalmente pausada." },
  EXPIRED: { label: "Vencido", description: "La suscripción terminó, pero el fan todavía puede ser contactable." },
  CANCELLED: { label: "Cancelado", description: "La suscripción fue cancelada y ya no está activa." },
} as const;

type SearchParams = Promise<{ filter?: string | string[]; page?: string | string[]; q?: string | string[] }>;

export default async function FansPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const filter = parseFanFilter(single(query.filter));
  const search = (single(query.q) ?? "").trim().slice(0, 80);
  const requestedPage = positiveInteger(single(query.page));
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const where = creatorId ? buildFansWhere(creatorId, filter, search) : null;
  const initialTotal = where ? await prisma.fan.count({ where }) : 0;
  const initialTotalPages = Math.max(1, Math.ceil(initialTotal / PAGE_SIZE));
  const initialPage = Math.min(requestedPage, initialTotalPages);
  const [fans, audienceMetrics] = creatorId && where ? await Promise.all([
    prisma.fan.findMany({
      where,
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      skip: (initialPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subscriptions: { orderBy: { startedAt: "desc" }, take: 1 },
        enrollments: { where: { status: { in: ["ACTIVE", "WAITING", "PAUSED"] } }, include: { workflow: true, currentStep: true }, take: 1 },
      },
    }),
    Promise.all([
      prisma.fan.count({ where: buildFansWhere(creatorId, "ALL", "") }),
      prisma.fan.count({ where: buildFansWhere(creatorId, "ONLINE", "") }),
      prisma.fan.count({ where: buildFansWhere(creatorId, "ACTIVE_SUBSCRIBERS", "") }),
      prisma.fan.count({ where: buildFansWhere(creatorId, "TOP_SPENDERS", "") }),
    ]),
  ]) : [[], [0, 0, 0, 0]];
  const total = initialTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const [allFans, onlineFans, activeSubscribers, vipFans] = audienceMetrics;
  const activeFilter = fanFilterOptions.find((option) => option.value === filter)!;

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100">
    <LiveRefresh /><FanPresenceReconciler /><StatusTooltips /><Sidebar />
    <div className="min-w-0 flex-1"><Topbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
        <div className="relative mb-5 overflow-hidden rounded-3xl border border-violet-400/15 bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,.18),transparent_34%),linear-gradient(135deg,#181a24,#111319)] p-5 shadow-[0_0_55px_rgba(124,58,237,.07)] sm:p-7">
          <div aria-hidden className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/80 to-transparent shadow-[0_0_18px_rgba(196,181,253,.65)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-violet-300">Audience intelligence</p><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Conoce a cada fan</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Identifica quién está conectado, quién ya compra y qué relación necesita atención antes de tu siguiente mensaje.</p></div>
            <Link href="/intelligence" className="group inline-flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-400/[.08] px-4 py-3 text-xs font-semibold text-violet-100 shadow-[0_0_25px_rgba(139,92,246,.08)] transition hover:border-violet-300/40 hover:bg-violet-400/[.13]">Abrir IA de fans<ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
          </div>
        </div>

        <section aria-label="Resumen de audiencia" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AudienceMetric icon={Users} label="Audiencia total" value={allFans} detail="Contactos confirmados" tone="violet" />
          <AudienceMetric icon={Activity} label="En línea ahora" value={onlineFans} detail="Actividad en los últimos 10 min" tone="emerald" />
          <AudienceMetric icon={UserCheck} label="Suscriptores activos" value={activeSubscribers} detail="Pago o prueba con acceso" tone="cyan" />
          <AudienceMetric icon={Crown} label="Fans VIP" value={vipFans} detail="Top spenders confirmados" tone="amber" />
        </section>

        <section className="mb-5 rounded-3xl border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.015))] p-3 shadow-[0_18px_45px_rgba(0,0,0,.16)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">Explorar audiencia</p><p className="mt-1 text-sm font-medium text-white">{activeFilter.label}</p></div><span className="rounded-full border border-violet-400/15 bg-violet-400/[.06] px-3 py-1.5 text-[10px] text-violet-200">{numberFormat.format(total)} resultados</span></div>
          <form className="flex flex-col gap-3 lg:flex-row" action="/fans">
            <input type="hidden" name="filter" value={filter} />
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-[#111319] px-4 transition focus-within:border-violet-400/50 focus-within:ring-2 focus-within:ring-violet-400/10">
              <Search className="size-4 shrink-0 text-zinc-500" /><span className="sr-only">Buscar fans</span>
              <input name="q" defaultValue={search} placeholder="Buscar por nombre o usuario…" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />
              {search ? <Link href={fansUrl({ filter })} aria-label="Limpiar búsqueda" className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></Link> : null}
            </label>
            <button className="h-11 rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400">Buscar</button>
          </form>
          <p className="mt-3 text-[11px] leading-5 text-zinc-600">{activeFilter.description}</p>
          <div className="mt-4 flex items-start gap-2 border-t border-white/8 pt-4">
            <Filter className="size-4 shrink-0 text-zinc-600" />
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">{fanFilterOptions.map((option) => <Link key={option.value} href={fansUrl({ filter: option.value, search })} title={option.description} aria-current={filter === option.value ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition ${filter === option.value ? "border-violet-400/30 bg-violet-500 text-white shadow-lg shadow-violet-950/30" : "border-white/8 bg-white/[.025] text-zinc-400 hover:border-white/15 hover:bg-white/6 hover:text-white"}`}>{option.label}</Link>)}</div>
          </div>
        </section>

        <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[.025] shadow-[0_20px_55px_rgba(0,0,0,.16)]">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/8 bg-black/10 text-xs uppercase tracking-wider text-zinc-600"><tr><th className="px-5 py-4">Fan</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Gastado</th><th className="px-5 py-4">Workflow</th><th className="px-5 py-4">Última actividad</th></tr></thead>
            <tbody>{fans.map((fan) => {
              const subscription = fan.subscriptions[0]; const subscriptionState = subscription ? subscriptionLabels[subscription.status] : null; const enrollment = fan.enrollments[0];
              return <tr key={fan.id} className="group border-b border-white/5 transition hover:bg-violet-400/[.025] last:border-0">
                <td className="px-5 py-4"><Link href={`/lifecycle/fans/${fan.id}`} className="flex items-center gap-3 rounded-lg outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-400/40">{fan.avatarUrl ? <span className="size-9 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }} /> : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-semibold text-zinc-500">{fanInitials(fan.displayName, fan.username)}</span>}<div><p className="font-medium text-zinc-200">{fan.displayName || fan.username || "Sin nombre"}</p><p className="mt-1 text-xs text-zinc-600">@{fan.username || "sin-usuario"}</p></div></Link></td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{isFanOnlineNow(fan.isOnline, fan.presenceChangedAt) ? <span title="Fanvue reportó actividad en línea durante los últimos 10 minutos." className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">En línea</span> : null}{fan.isFollower ? <span title="Te sigue actualmente en Fanvue." className="rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-300">Seguidor</span> : null}{subscriptionState ? <span title={subscriptionState.description} className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">{subscription?.isFreeTrial ? "Prueba gratuita" : subscriptionState.label}</span> : fan.isExpiredSubscriber ? <span title="Tuvo una suscripción y todavía es contactable." className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">Vencido</span> : null}{isConfirmedVip(fan.isTopSpender, fan.totalSpentMinor) ? <span title="Fanvue lo clasifica como top spender y registra gasto confirmado mayor a $0." className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">VIP</span> : null}</div></td>
                <td className="px-5 py-4 font-medium text-zinc-300">{currency.format(fan.totalSpentMinor / 100)}</td>
                <td className="px-5 py-4"><p className="text-zinc-300">{enrollment?.workflow.name ?? "Sin workflow"}</p><p className="mt-1 text-xs text-zinc-600">{enrollment?.currentStep?.name ?? "Sin próxima acción"}</p></td>
                <td className="px-5 py-4"><div className="flex items-center justify-between gap-3"><span className="text-zinc-500">{fan.lastActivityAt?.toLocaleString("es-MX") ?? "Sin actividad"}</span><Link href={`/lifecycle/fans/${fan.id}`} aria-label={`Ver perfil de ${fan.displayName || fan.username || "fan"}`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/0 text-zinc-700 transition group-hover:border-violet-400/15 group-hover:bg-violet-400/[.06] group-hover:text-violet-300"><ArrowUpRight className="size-4" /></Link></div></td>
              </tr>;
            })}</tbody>
          </table></div>

          <div className="divide-y divide-white/6 md:hidden">{fans.map((fan) => {
            const subscription = fan.subscriptions[0]; const subscriptionState = subscription ? subscriptionLabels[subscription.status] : null; const enrollment = fan.enrollments[0];
            return <Link key={fan.id} href={`/lifecycle/fans/${fan.id}`} className="group block p-4 transition hover:bg-violet-400/[.025]">
              <div className="flex items-start gap-3">{fan.avatarUrl ? <span className="size-11 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-white/10" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }} /> : <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/8 bg-white/5 text-xs font-semibold text-zinc-500">{fanInitials(fan.displayName, fan.username)}</span>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-100">{fan.displayName || fan.username || "Sin nombre"}</p><p className="mt-0.5 truncate text-[11px] text-zinc-600">@{fan.username || "sin-usuario"}</p></div><div className="text-right"><p className="text-sm font-semibold text-white">{currency.format(fan.totalSpentMinor / 100)}</p><ArrowUpRight className="ml-auto mt-1 size-3.5 text-violet-400/50" /></div></div><div className="mt-3 flex flex-wrap gap-1.5">{isFanOnlineNow(fan.isOnline, fan.presenceChangedAt) ? <FanBadge tone="emerald">En línea</FanBadge> : null}{fan.isFollower ? <FanBadge tone="sky">Seguidor</FanBadge> : null}{subscriptionState ? <FanBadge tone="violet">{subscription?.isFreeTrial ? "Prueba gratuita" : subscriptionState.label}</FanBadge> : fan.isExpiredSubscriber ? <FanBadge tone="violet">Vencido</FanBadge> : null}{isConfirmedVip(fan.isTopSpender, fan.totalSpentMinor) ? <FanBadge tone="amber">VIP</FanBadge> : null}</div></div></div>
              <div className="mt-3 grid grid-cols-2 gap-2"><div className="min-w-0 rounded-xl border border-white/6 bg-black/15 px-3 py-2"><p className="text-[9px] uppercase tracking-wide text-zinc-700">Workflow</p><p className="mt-1 truncate text-[11px] text-zinc-400">{enrollment?.workflow.name ?? "Sin workflow"}</p></div><div className="min-w-0 rounded-xl border border-white/6 bg-black/15 px-3 py-2"><p className="text-[9px] uppercase tracking-wide text-zinc-700">Actividad</p><p className="mt-1 truncate text-[11px] text-zinc-400">{fan.lastActivityAt?.toLocaleDateString("es-MX") ?? "Sin actividad"}</p></div></div>
            </Link>;
          })}</div>

          {fans.length === 0 ? <div className="grid min-h-64 place-items-center px-5 text-center"><div><Users className="mx-auto mb-4 size-7 text-zinc-700" /><p className="text-sm text-zinc-300">No encontramos fans</p><p className="mt-1 text-xs text-zinc-600">Prueba otro filtro o elimina el texto de búsqueda.</p>{filter !== "ALL" || search ? <Link href="/fans" className="mt-4 inline-flex rounded-lg bg-white/6 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white">Ver todos</Link> : null}</div></div> : null}

          {total > 0 ? <nav aria-label="Paginación de fans" className="flex flex-col gap-3 border-t border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-zinc-500">Mostrando <strong className="font-medium text-zinc-300">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> de <strong className="font-medium text-zinc-300">{numberFormat.format(total)}</strong></p>
            <div className="flex items-center gap-2"><PaginationLink disabled={page === 1} href={fansUrl({ filter, search, page: page - 1 })} label="Página anterior"><ChevronLeft className="size-4" />Anterior</PaginationLink><span className="min-w-20 text-center text-xs text-zinc-500">{page} de {totalPages}</span><PaginationLink disabled={page === totalPages} href={fansUrl({ filter, search, page: page + 1 })} label="Página siguiente">Siguiente<ChevronRight className="size-4" /></PaginationLink></div>
          </nav> : null}
        </div>
      </main>
    </div>
  </div>;
}

function PaginationLink({ disabled, href, label, children }: { disabled: boolean; href: string; label: string; children: ReactNode }) {
  const styles = "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition";
  return disabled ? <span aria-disabled="true" className={`${styles} cursor-not-allowed border-white/5 text-zinc-700`}>{children}</span> : <Link href={href} aria-label={label} className={`${styles} border-white/10 text-zinc-300 hover:border-violet-400/30 hover:bg-violet-400/10 hover:text-white`}>{children}</Link>;
}

function AudienceMetric({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Users;
  label: string;
  value: number;
  detail: string;
  tone: "violet" | "emerald" | "cyan" | "amber";
}) {
  const styles = {
    violet: "border-violet-400/15 bg-violet-400/[.035] text-violet-300 shadow-violet-500/10",
    emerald: "border-emerald-400/15 bg-emerald-400/[.03] text-emerald-300 shadow-emerald-500/10",
    cyan: "border-cyan-400/15 bg-cyan-400/[.03] text-cyan-300 shadow-cyan-500/10",
    amber: "border-amber-400/15 bg-amber-400/[.03] text-amber-300 shadow-amber-500/10",
  }[tone];
  return <article className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_0_28px_var(--tw-shadow-color)] ${styles}`}>
    <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-current/70 to-transparent" />
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-zinc-600">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{numberFormat.format(value)}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-current/15 bg-current/[.06]"><Icon className="size-4" /></span></div>
  </article>;
}

function FanBadge({ children, tone }: { children: ReactNode; tone: "emerald" | "sky" | "violet" | "amber" }) {
  const styles = {
    emerald: "border-emerald-400/15 bg-emerald-400/8 text-emerald-300",
    sky: "border-sky-400/15 bg-sky-400/8 text-sky-300",
    violet: "border-violet-400/15 bg-violet-400/8 text-violet-300",
    amber: "border-amber-400/15 bg-amber-400/8 text-amber-300",
  }[tone];
  return <span className={`rounded-full border px-2 py-1 text-[9px] font-medium ${styles}`}>{children}</span>;
}

function fansUrl({ filter = "ALL", search = "", page }: { filter?: FanFilter; search?: string; page?: number }) { const params = new URLSearchParams(); if (filter !== "ALL") params.set("filter", filter); if (search) params.set("q", search); if (page && page > 1) params.set("page", String(page)); const query = params.toString(); return query ? `/fans?${query}` : "/fans"; }
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function positiveInteger(value: string | undefined) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; }
function fanInitials(displayName: string | null, username: string | null) { return (displayName || username || "F").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
