"use client";

import { AlertTriangle, Check, Clock3, LoaderCircle, MessageSquare, Route, X } from "lucide-react";
import { useEffect, useState } from "react";
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
    fetch(`/api/enrollments/${enrollment.id}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body.enrollment as HistoryDetail; })
      .then(setDetail)
      .catch((caught) => { if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message); });
    return () => controller.abort();
  }, [enrollment.id]);

  return <div role="dialog" aria-modal="true" aria-labelledby="history-title" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-violet-400/20 bg-[#161820] shadow-2xl shadow-black/60"><header className="flex items-start justify-between gap-4 border-b border-white/8 p-5"><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[.16em] text-violet-400">Historial del fan</p><h2 id="history-title" className="mt-1 truncate text-xl font-semibold text-white">{enrollment.fanName}</h2><p className="mt-1 text-xs text-zinc-500">{enrollment.fanUsername ? `@${enrollment.fanUsername} · ` : ""}{enrollment.workflowName}</p></div><button type="button" onClick={onClose} aria-label="Cerrar historial" className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-5" /></button></header><div className="overflow-y-auto p-5">{error ? <p className="rounded-xl border border-red-400/20 bg-red-400/8 p-4 text-sm text-red-200">{error}</p> : !detail ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500"><LoaderCircle className="size-5 animate-spin text-violet-400" />Cargando línea de tiempo…</div> : <><div className="grid gap-3 sm:grid-cols-3"><Summary label="Workflow" value={`${detail.workflowName} · v${detail.workflowVersion}`} /><Summary label="Estado" value={statusLabel(detail.status)} /><Summary label="Inicio" value={formatDate(detail.startedAt)} /></div>{detail.pauseReason || detail.cancellationReason ? <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[.04] px-4 py-3 text-xs text-amber-200/80">{detail.cancellationReason || detail.pauseReason}</p> : null}<ol className="relative mt-6 ml-3 border-l border-white/10 pl-6">{detail.logs.map((log) => <li key={log.id} className="relative pb-6 last:pb-0"><span className={`absolute -left-[34px] grid size-4 place-items-center rounded-full ring-4 ring-[#161820] ${tone(log)}`}><EventIcon log={log} /></span><div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-sm text-zinc-200">{log.explanation}</p>{log.stepName || log.templateName ? <p className="mt-1 text-xs text-violet-300/70">{log.stepName ? `Paso: ${log.stepName}` : ""}{log.stepName && log.templateName ? " · " : ""}{log.templateName ? `Plantilla: ${log.templateName}` : ""}</p> : null}{log.detail ? <p className={`mt-1 text-xs ${log.level === "ERROR" ? "text-red-300" : "text-zinc-500"}`}>{log.detail}{log.detailDate ? `: ${formatDate(log.detailDate)}.` : ""}</p> : null}{log.reasonCode ? <p className="mt-1 font-mono text-[10px] text-zinc-700">{log.reasonCode}</p> : null}</div><time dateTime={log.occurredAt} className="shrink-0 text-[11px] text-zinc-600">{formatDate(log.occurredAt)}</time></div></li>)}{detail.logs.length === 0 ? <p className="-ml-3 py-8 text-center text-sm text-zinc-600">Esta ejecución no tiene eventos registrados.</p> : null}</ol></>}</div></div></div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-black/15 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-1 truncate text-xs font-medium text-zinc-300">{value}</p></div>; }
function formatDate(value: string) { return new Date(value).toLocaleString("es-MX"); }
function statusLabel(status: EnrollmentHistorySummaryView["status"]) { return ({ ACTIVE: "Ejecutando", WAITING: "Esperando", PAUSED: "Pausado", COMPLETED: "Completado", CANCELLED: "Cancelado", FAILED: "Fallido" })[status]; }
function tone(log: EnrollmentHistoryLogView) { return log.level === "ERROR" ? "bg-red-400 text-red-950" : log.eventType.includes("MESSAGE") || log.eventType.includes("PPV") || log.eventType.includes("REPLIED") ? "bg-violet-400 text-violet-950" : log.eventType.includes("COMPLETED") || log.eventType.includes("GOAL") ? "bg-emerald-400 text-emerald-950" : "bg-zinc-600 text-zinc-950"; }
function EventIcon({ log }: { log: EnrollmentHistoryLogView }) { const Icon = log.level === "ERROR" ? AlertTriangle : log.eventType.includes("MESSAGE") || log.eventType.includes("PPV") || log.eventType.includes("REPLIED") ? MessageSquare : log.eventType.includes("WAIT") || log.eventType.includes("PAUSED") ? Clock3 : log.eventType.includes("COMPLETED") || log.eventType.includes("GOAL") ? Check : Route; return <Icon className="size-2.5" />; }
