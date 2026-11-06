"use client";

import { ChevronLeft, ChevronRight, History, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { formatAppDateTime } from "@/lib/date-time";
import { EnrollmentHistoryDialog } from "./enrollment-history-dialog";
import type { EnrollmentHistorySummaryView, WorkflowView } from "./types";

type Pagination = { page: number; pageSize: number; total: number; pages: number };

export function WorkflowHistoryBrowser({ workflows }: { workflows: Pick<WorkflowView, "id" | "name">[] }) {
  const [entries, setEntries] = useState<EnrollmentHistorySummaryView[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, pages: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EnrollmentHistorySummaryView | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), search, workflowId, status });
    let fetching = false;
    const load = async () => {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const response = await fetch(`/api/enrollments/history?${params}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setEntries(body.entries); setPagination(body.pagination); setError(null);
      } catch (caught) {
        if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message);
      } finally { fetching = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [page, revision, search, status, workflowId]);

  function beginLoad() { setLoading(true); setError(null); setRevision((value) => value + 1); }
  function submit(event: FormEvent) { event.preventDefault(); beginLoad(); setPage(1); setSearch(searchInput.trim()); }
  function reset() { beginLoad(); setSearchInput(""); setSearch(""); setWorkflowId(""); setStatus(""); setPage(1); }
  const filtered = Boolean(search || workflowId || status);

  return <section id="historial-workflows" className="relative mt-6 min-w-0 max-w-full scroll-mt-20 overflow-hidden rounded-3xl border border-sky-400/15 bg-[#11131a] p-4 shadow-[0_18px_60px_rgba(0,0,0,.22),0_0_35px_rgba(56,189,248,.04)] sm:p-5">
    <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-sky-500/[.07] blur-3xl" />
    <div className="relative flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-sky-400/15 bg-sky-400/[.06] text-sky-300"><History className="size-4" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-sky-300">Trazabilidad</p><h3 className="mt-1 text-base font-semibold text-white">Historial por fan</h3><p className="mt-0.5 text-[11px] text-zinc-600">Encuentra una ejecución y abre su línea de tiempo completa.</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[.04] px-2.5 py-1 text-[10px] text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />En vivo</span></div>
    <form onSubmit={submit} className="relative mt-5 grid gap-2 lg:grid-cols-[1fr_220px_180px_auto]"><label className="relative"><span className="sr-only">Buscar fan</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar por nombre o @usuario" className="h-11 w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pr-3 pl-10 text-sm text-zinc-200 outline-none transition focus:border-sky-400/30 focus:shadow-[0_0_18px_rgba(56,189,248,.06)]" /></label><select aria-label="Filtrar por workflow" value={workflowId} onChange={(event) => { beginLoad(); setWorkflowId(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-white/10 bg-[#1b1d25] px-3 text-sm text-zinc-300"><option value="">Todos los workflows</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select><select aria-label="Filtrar por estado" value={status} onChange={(event) => { beginLoad(); setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-white/10 bg-[#1b1d25] px-3 text-sm text-zinc-300"><option value="">Todos los estados</option><option value="ACTIVE">Activo</option><option value="WAITING">Esperando</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Completado</option><option value="CANCELLED">Cancelado</option><option value="FAILED">Fallido</option></select><div className="flex gap-2"><button type="submit" className="h-11 flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 text-sm font-semibold text-white shadow-[0_0_20px_rgba(56,189,248,.12)]">Buscar</button>{filtered ? <button type="button" onClick={reset} aria-label="Limpiar filtros" className="grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 text-zinc-500 hover:border-red-400/20 hover:text-red-300"><X className="size-4" /></button> : null}</div></form>
    {error ? <p className="relative mt-3 rounded-xl border border-red-400/20 bg-red-400/8 p-3 text-xs text-red-200">{error}</p> : null}
    {loading ? <div className="relative flex justify-center gap-2 py-12 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin text-sky-400" />Cargando historial…</div> : <div className="relative mt-4 grid gap-2 lg:grid-cols-2">{entries.map((entry) => <button key={entry.id} type="button" onClick={() => setSelected(entry)} className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/6 bg-black/20 px-4 py-3.5 text-left transition hover:border-sky-400/25 hover:bg-sky-400/[.035]"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-zinc-200">{entry.fanName}</p><HistoryStatus status={entry.status} /></div><p className="mt-1 truncate text-[11px] text-zinc-600">{entry.workflowName}</p><p className="mt-1 text-[10px] text-zinc-700">Inició {formatAppDateTime(entry.startedAt)}</p></div><span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/8 text-sky-300 transition group-hover:border-sky-400/25 group-hover:bg-sky-400/10"><Sparkles className="size-3.5" /></span></button>)}{!entries.length ? <p className="col-span-full rounded-2xl border border-dashed border-white/8 py-10 text-center text-xs text-zinc-600">No se encontraron ejecuciones con estos filtros.</p> : null}</div>}
    <div className="relative mt-4 flex flex-col justify-between gap-3 border-t border-white/6 pt-4 text-xs text-zinc-600 sm:flex-row sm:items-center"><p>{pagination.total} ejecuciones · página {pagination.page} de {pagination.pages}</p><div className="flex gap-2"><PageButton disabled={loading || pagination.page <= 1} onClick={() => { beginLoad(); setPage((value) => value - 1); }} icon={ChevronLeft}>Anterior</PageButton><PageButton disabled={loading || pagination.page >= pagination.pages} onClick={() => { beginLoad(); setPage((value) => value + 1); }} icon={ChevronRight} trailing>Siguiente</PageButton></div></div>
    {selected ? <EnrollmentHistoryDialog enrollment={selected} onClose={() => setSelected(null)} /> : null}
  </section>;
}

function PageButton({ children, disabled, onClick, icon: Icon, trailing }: { children: string; disabled: boolean; onClick: () => void; icon: typeof ChevronLeft; trailing?: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/8 px-3 py-2 transition hover:border-sky-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">{!trailing ? <Icon className="size-3.5" /> : null}{children}{trailing ? <Icon className="size-3.5" /> : null}</button>; }
function HistoryStatus({ status }: { status: EnrollmentHistorySummaryView["status"] }) { const labels = { ACTIVE: "Activo", WAITING: "Esperando", PAUSED: "Pausado", COMPLETED: "Completado", CANCELLED: "Cancelado", FAILED: "Fallido" }; const tone = status === "COMPLETED" ? "border-emerald-400/15 bg-emerald-400/[.06] text-emerald-300" : status === "FAILED" || status === "CANCELLED" ? "border-red-400/15 bg-red-400/[.06] text-red-300" : status === "PAUSED" ? "border-amber-400/15 bg-amber-400/[.06] text-amber-300" : "border-sky-400/15 bg-sky-400/[.06] text-sky-300"; return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] ${tone}`}>{labels[status]}</span>; }
