import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronLeft, ChevronRight, Filter, Search, Users, X } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LiveRefresh } from "@/components/live-refresh";
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
  const total = where ? await prisma.fan.count({ where }) : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const fans = where ? await prisma.fan.findMany({
    where,
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      subscriptions: { orderBy: { startedAt: "desc" }, take: 1 },
      enrollments: { where: { status: { in: ["ACTIVE", "WAITING", "PAUSED"] } }, include: { workflow: true, currentStep: true }, take: 1 },
    },
  }) : [];
  const activeFilter = fanFilterOptions.find((option) => option.value === filter)!;

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100">
    <LiveRefresh /><StatusTooltips /><Sidebar />
    <div className="min-w-0 flex-1"><Topbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">CRM</p><h1 className="text-3xl font-semibold tracking-tight text-white">Fans</h1><p className="mt-2 text-sm text-zinc-500">Encuentra rápidamente a cada audiencia y revisa su relación contigo.</p></div>
          <div className="rounded-xl border border-white/8 bg-white/[.035] px-4 py-3 text-right"><p className="text-xl font-semibold text-white">{numberFormat.format(total)}</p><p className="text-[11px] text-zinc-500">{activeFilter.label.toLowerCase()}</p></div>
        </div>

        <section className="mb-5 rounded-2xl border border-white/8 bg-white/[.025] p-3 sm:p-4">
          <form className="flex flex-col gap-3 lg:flex-row" action="/fans">
            <input type="hidden" name="filter" value={filter} />
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-[#111319] px-4 transition focus-within:border-violet-400/50 focus-within:ring-2 focus-within:ring-violet-400/10">
              <Search className="size-4 shrink-0 text-zinc-500" /><span className="sr-only">Buscar fans</span>
              <input name="q" defaultValue={search} placeholder="Buscar por nombre o usuario…" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />
              {search ? <Link href={fansUrl({ filter })} aria-label="Limpiar búsqueda" className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></Link> : null}
            </label>
            <button className="h-11 rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400">Buscar</button>
          </form>
          <div className="mt-4 flex items-center gap-2 border-t border-white/8 pt-4">
            <Filter className="size-4 shrink-0 text-zinc-600" />
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">{fanFilterOptions.map((option) => <Link key={option.value} href={fansUrl({ filter: option.value, search })} title={option.description} aria-current={filter === option.value ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition ${filter === option.value ? "border-violet-400/30 bg-violet-500 text-white shadow-lg shadow-violet-950/30" : "border-white/8 bg-white/[.025] text-zinc-400 hover:border-white/15 hover:bg-white/6 hover:text-white"}`}>{option.label}</Link>)}</div>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/8 bg-black/10 text-xs uppercase tracking-wider text-zinc-600"><tr><th className="px-5 py-4">Fan</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Gastado</th><th className="px-5 py-4">Workflow</th><th className="px-5 py-4">Última actividad</th></tr></thead>
            <tbody>{fans.map((fan) => {
              const subscription = fan.subscriptions[0]; const subscriptionState = subscription ? subscriptionLabels[subscription.status] : null; const enrollment = fan.enrollments[0];
              return <tr key={fan.id} className="border-b border-white/5 transition hover:bg-white/[.025] last:border-0">
                <td className="px-5 py-4"><div className="flex items-center gap-3">{fan.avatarUrl ? <span className="size-9 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }} /> : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-semibold text-zinc-500">{fanInitials(fan.displayName, fan.username)}</span>}<div><p className="font-medium text-zinc-200">{fan.displayName || fan.username || "Sin nombre"}</p><p className="mt-1 text-xs text-zinc-600">@{fan.username || "sin-usuario"}</p></div></div></td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{isFanOnlineNow(fan.isOnline, fan.presenceChangedAt) ? <span title="Fanvue reportó actividad en línea durante los últimos 10 minutos." className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">En línea</span> : null}{fan.isFollower ? <span title="Te sigue actualmente en Fanvue." className="rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-300">Seguidor</span> : null}{subscriptionState ? <span title={subscriptionState.description} className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">{subscription?.isFreeTrial ? "Prueba gratuita" : subscriptionState.label}</span> : fan.isExpiredSubscriber ? <span title="Tuvo una suscripción y todavía es contactable." className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">Vencido</span> : null}{isConfirmedVip(fan.isTopSpender, fan.totalSpentMinor) ? <span title="Fanvue lo clasifica como top spender y registra gasto confirmado mayor a $0." className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">VIP</span> : null}</div></td>
                <td className="px-5 py-4 font-medium text-zinc-300">{currency.format(fan.totalSpentMinor / 100)}</td>
                <td className="px-5 py-4"><p className="text-zinc-300">{enrollment?.workflow.name ?? "Sin workflow"}</p><p className="mt-1 text-xs text-zinc-600">{enrollment?.currentStep?.name ?? "Sin próxima acción"}</p></td>
                <td className="px-5 py-4 text-zinc-500">{fan.lastActivityAt?.toLocaleString("es-MX") ?? "Sin actividad"}</td>
              </tr>;
            })}</tbody>
          </table></div>

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

function fansUrl({ filter = "ALL", search = "", page }: { filter?: FanFilter; search?: string; page?: number }) { const params = new URLSearchParams(); if (filter !== "ALL") params.set("filter", filter); if (search) params.set("q", search); if (page && page > 1) params.set("page", String(page)); const query = params.toString(); return query ? `/fans?${query}` : "/fans"; }
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function positiveInteger(value: string | undefined) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : 1; }
function fanInitials(displayName: string | null, username: string | null) { return (displayName || username || "F").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
