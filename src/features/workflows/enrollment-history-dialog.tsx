"use client";

import { AlertTriangle, Check, Clock3, LoaderCircle, MessageSquare, Route, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatAppDateTime } from "@/lib/date-time";
import type { EnrollmentHistoryLogView, EnrollmentHistorySummaryView } from "./types";

interface HistoryDetail extends EnrollmentHistorySummaryView {
  workflowVersion: number;
  pauseReason: string | null;
  cancellationReason: string | null;
  logs: EnrollmentHistoryLogView[];
}

export function EnrollmentHistoryDialog({ enrollment, onClose }: { enrollment: EnrollmentHistorySummaryView; onClose: () => void }) {
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let fetching = false;
    const load = async () => {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const response = await fetch(`/api/enrollments/${enrollment.id}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setDetail(body.enrollment as HistoryDetail);
        setError(null);
      } catch (caught) {
        if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message);
      } finally { fetching = false; }
    };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 10_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [enrollment.id, onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="history-title" className="fixed inset-0 z-[500] grid place-items-center bg-black/80 p-3 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-violet-400/20 bg-[#11131a] shadow-[0_28px_100px_rgba(0,0,0,.72),0_0_50px_rgba(139,92,246,.09)]">
        <div className="absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
        <header className="flex items-start justify-between gap-4 border-b border-white/8 bg-gradient-to-br from-violet-500/[.08] to-transparent p-5 sm:p-6">
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Ejecución en tiempo real</p><h2 id="history-title" className="mt-1 truncate text-xl font-semibold text-white">{enrollment.fanName}</h2><p className="mt-1 text-xs text-zinc-500">{enrollment.fanUsername ? `@${enrollment.fanUsername} · ` : ""}{enrollment.workflowName}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar historial" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/8 text-zinc-500 transition hover:border-violet-400/25 hover:bg-violet-400/10 hover:text-white"><X className="size-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/8 p-4 text-sm text-red-200">{error}</p> : !detail ? <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500"><LoaderCircle className="size-5 animate-spin text-violet-400" />Cargando línea de tiempo…</div> : <>
            <div className="grid gap-3 sm:grid-cols-3"><Summary label="Workflow" value={`${detail.workflowName} · v${detail.workflowVersion}`} /><Summary label="Estado actual" value={statusLabel(detail.status)} accent /><Summary label="Comenzó" value={formatAppDateTime(detail.startedAt)} /></div>
            {detail.pauseReason || detail.cancellationReason ? <p className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/[.04] px-4 py-3 text-xs leading-5 text-amber-200/80">{detail.cancellationReason || detail.pauseReason}</p> : null}
            <div className="mt-7 flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium text-white">Línea de tiempo</h3><p className="mt-0.5 text-[11px] text-zinc-600">Fechas mostradas en horario de Monterrey.</p></div><span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.04] px-2.5 py-1 text-[10px] text-emerald-300">Actualización automática</span></div>
            <ol className="relative mt-5 ml-3 border-l border-violet-400/15 pl-6">{detail.logs.map((log) => <li key={log.id} className="relative pb-5 last:pb-0"><span className={`absolute -left-[34px] grid size-4 place-items-center rounded-full ring-4 ring-[#11131a] ${tone(log)}`}><EventIcon log={log} /></span><article className="rounded-2xl border border-white/7 bg-white/[.025] p-3.5 transition hover:border-violet-400/15"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-sm leading-5 text-zinc-200">{log.explanation}</p>{log.stepName || log.templateName ? <p className="mt-1 text-xs text-violet-300/70">{log.stepName ? `Paso: ${log.stepName}` : ""}{log.stepName && log.templateName ? " · " : ""}{log.templateName ? `Plantilla: ${log.templateName}` : ""}</p> : null}</div><time dateTime={log.occurredAt} className="shrink-0 text-[10px] text-zinc-600">{formatAppDateTime(log.occurredAt)}</time></div>{log.detail ? <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${log.level === "ERROR" ? "border-red-400/15 bg-red-400/[.04] text-red-300" : "border-white/6 bg-black/15 text-zinc-500"}`}>{log.detail}{log.detailDate ? `: ${formatAppDateTime(log.detailDate)}.` : ""}</p> : null}{log.reasonCode ? <p className="mt-2 font-mono text-[9px] uppercase tracking-wide text-zinc-700">{log.reasonCode}</p> : null}</article></li>)}{detail.logs.length === 0 ? <p className="-ml-3 py-8 text-center text-sm text-zinc-600">Esta ejecución no tiene eventos registrados.</p> : null}</ol>
          </>}
        </div>
      </section>
    </div>, document.body,
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className={`rounded-2xl border p-3.5 ${accent ? "border-violet-400/20 bg-violet-400/[.05]" : "border-white/8 bg-black/15"}`}><p className="text-[9px] uppercase tracking-[.14em] text-zinc-600">{label}</p><p className={`mt-1.5 truncate text-xs font-medium ${accent ? "text-violet-200" : "text-zinc-300"}`}>{value}</p></div>; }
function statusLabel(status: EnrollmentHistorySummaryView["status"]) { return ({ ACTIVE: "Ejecutando", WAITING: "Esperando", PAUSED: "Pausado", COMPLETED: "Completado", CANCELLED: "Cancelado", FAILED: "Fallido" })[status]; }
function tone(log: EnrollmentHistoryLogView) { return log.level === "ERROR" ? "bg-red-400 text-red-950" : log.eventType.includes("MESSAGE") || log.eventType.includes("PPV") || log.eventType.includes("REPLIED") ? "bg-violet-400 text-violet-950" : log.eventType.includes("COMPLETED") || log.eventType.includes("GOAL") ? "bg-emerald-400 text-emerald-950" : "bg-zinc-600 text-zinc-950"; }
function EventIcon({ log }: { log: EnrollmentHistoryLogView }) { const Icon = log.level === "ERROR" ? AlertTriangle : log.eventType.includes("MESSAGE") || log.eventType.includes("PPV") || log.eventType.includes("REPLIED") ? MessageSquare : log.eventType.includes("WAIT") || log.eventType.includes("PAUSED") ? Clock3 : log.eventType.includes("COMPLETED") || log.eventType.includes("GOAL") ? Check : Route; return <Icon className="size-2.5" />; }
