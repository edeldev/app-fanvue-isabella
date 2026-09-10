"use client";

import { ChevronLeft, ChevronRight, History, LoaderCircle, Search, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
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
    fetch(`/api/enrollments/history?${params}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; })
      .then((body) => { setEntries(body.entries); setPagination(body.pagination); })
      .catch((caught) => { if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, revision, search, status, workflowId]);

  function beginLoad() { setLoading(true); setError(null); setRevision((value) => value + 1); }
  function submit(event: FormEvent) { event.preventDefault(); beginLoad(); setPage(1); setSearch(searchInput.trim()); }
  function reset() { beginLoad(); setSearchInput(""); setSearch(""); setWorkflowId(""); setStatus(""); setPage(1); }
  const filtered = Boolean(search || workflowId || status);

  return <div id="historial-workflows" className="mt-6 scroll-mt-20 border-t border-white/8 pt-5">
    <div className="flex items-center gap-2"><History className="size-4 text-violet-400" /><div><h3 className="text-sm font-medium text-white">Historial por fan</h3><p className="mt-0.5 text-[11px] text-zinc-600">Busca todas las ejecuciones y abre su línea de tiempo completa.</p></div></div>
    <form onSubmit={submit} className="mt-4 grid gap-2 lg:grid-cols-[1fr_220px_180px_auto]">
      <label className="relative"><span className="sr-only">Buscar fan</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nombre o @usuario" className="w-full rounded-xl border border-white/10 bg-[#1b1d25] py-2.5 pr-3 pl-10 text-sm text-zinc-200 outline-none focus:border-violet-400/30" /></label>
      <select aria-label="Filtrar por workflow" value={workflowId} onChange={(event) => { beginLoad(); setWorkflowId(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-[#1b1d25] px-3 py-2.5 text-sm text-zinc-300"><option value="">Todos los workflows</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select>
      <select aria-label="Filtrar por estado" value={status} onChange={(event) => { beginLoad(); setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-white/10 bg-[#1b1d25] px-3 py-2.5 text-sm text-zinc-300"><option value="">Todos los estados</option><option value="ACTIVE">Activo</option><option value="WAITING">Esperando</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Completado</option><option value="CANCELLED">Cancelado</option><option value="FAILED">Fallido</option></select>
      <div className="flex gap-2"><button type="submit" className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400">Buscar</button>{filtered ? <button type="button" onClick={reset} aria-label="Limpiar filtros" className="rounded-xl border border-white/10 p-2.5 text-zinc-500 hover:text-white"><X className="size-4" /></button> : null}</div>
    </form>
    {error ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/8 p-3 text-xs text-red-200">{error}</p> : null}
    {loading ? <div className="flex justify-center gap-2 py-10 text-sm text-zinc-600"><LoaderCircle className="size-4 animate-spin" />Cargando historial…</div> : <div className="mt-3 grid gap-2 lg:grid-cols-2">{entries.map((entry) => <button key={entry.id} type="button" onClick={() => setSelected(entry)} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/15 px-4 py-3 text-left transition hover:border-violet-400/20 hover:bg-violet-400/[.04]"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-zinc-200">{entry.fanName}</p><HistoryStatus status={entry.status} /></div><p className="mt-1 truncate text-[11px] text-zinc-600">{entry.workflowName} · inició {new Date(entry.startedAt).toLocaleString("es-MX")}</p></div><span className="shrink-0 text-[11px] font-medium text-violet-300">Ver detalle</span></button>)}{!entries.length ? <p className="col-span-full py-8 text-center text-xs text-zinc-600">No se encontraron ejecuciones con estos filtros.</p> : null}</div>}
    <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/6 pt-4 text-xs text-zinc-600 sm:flex-row sm:items-center"><p>{pagination.total} ejecuciones · página {pagination.page} de {pagination.pages}</p><div className="flex gap-2"><button type="button" disabled={loading || pagination.page <= 1} onClick={() => { beginLoad(); setPage((value) => value - 1); }} className="flex items-center gap-1 rounded-lg border border-white/8 px-3 py-2 hover:text-white disabled:opacity-30"><ChevronLeft className="size-3.5" />Anterior</button><button type="button" disabled={loading || pagination.page >= pagination.pages} onClick={() => { beginLoad(); setPage((value) => value + 1); }} className="flex items-center gap-1 rounded-lg border border-white/8 px-3 py-2 hover:text-white disabled:opacity-30">Siguiente<ChevronRight className="size-3.5" /></button></div></div>
    {selected ? <EnrollmentHistoryDialog enrollment={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function HistoryStatus({ status }: { status: EnrollmentHistorySummaryView["status"] }) {
  const labels = { ACTIVE: "Activo", WAITING: "Esperando", PAUSED: "Pausado", COMPLETED: "Completado", CANCELLED: "Cancelado", FAILED: "Fallido" };
  const tone = status === "COMPLETED" ? "bg-emerald-400/10 text-emerald-300" : status === "FAILED" || status === "CANCELLED" ? "bg-red-400/10 text-red-300" : status === "PAUSED" ? "bg-amber-400/10 text-amber-300" : "bg-sky-400/10 text-sky-300";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${tone}`}>{labels[status]}</span>;
}
