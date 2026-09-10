"use client";

import { useState } from "react";
import { Eye, History, Pause, Play, RotateCcw, Trash2, UserPlus, XCircle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AutomationLogView, EnrollmentHistorySummaryView, EnrollmentProgressView, EnrollmentView, FanOption, WorkflowView } from "./types";
import { ActivityDeleteDialog, type ActivityDeleteScope } from "./activity-delete-dialog";
import { EnrollmentHistoryDialog } from "./enrollment-history-dialog";
import type { AudienceSegment } from "@/domain/workflows/audience";

type AudienceOption = { id: AudienceSegment; label: string; count: number };

export function EnrollmentPanel({ fans, audiences, workflows, enrollments, unstartedEnrollmentIds, enrollmentProgress, enrollmentHistory, activity, activityCounts }: { fans: FanOption[]; audiences: AudienceOption[]; workflows: Pick<WorkflowView, "id" | "name">[]; enrollments: EnrollmentView[]; unstartedEnrollmentIds: string[]; enrollmentProgress: EnrollmentProgressView; enrollmentHistory: EnrollmentHistorySummaryView[]; activity: AutomationLogView[]; activityCounts: { all: number; olderThan90Days: number } }) {
  const router = useRouter();
  const [fanId, setFanId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [destination, setDestination] = useState<"fan" | "audience">("fan");
  const [included, setIncluded] = useState<AudienceSegment[]>([]);
  const [excluded, setExcluded] = useState<AudienceSegment[]>([]);
  const [excludedFanIds, setExcludedFanIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [readyEnrollmentIds, setReadyEnrollmentIds] = useState<string[]>(unstartedEnrollmentIds);
  const [preview, setPreview] = useState<{ key: string; matched: number; newAssignments: number; alreadyReady: number; alreadyActive: number; skipped: number; limited: boolean } | null>(null);
  const [deleteScope, setDeleteScope] = useState<ActivityDeleteScope | null>(null);
  const [historyEnrollment, setHistoryEnrollment] = useState<EnrollmentHistorySummaryView | null>(null);
  const audienceKey = JSON.stringify({ included, excluded, excludedFanIds, workflowId });

  async function request(url: string, options: RequestInit) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(url, options);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.refresh();
      return body;
    } catch (caught) {
      setError(translate(caught instanceof Error ? caught.message : "Error inesperado."));
      return null;
    } finally { setBusy(false); }
  }

  async function assign() {
    const assigned = await request("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(destination === "fan" ? { mode: "fan", fanId, workflowId } : { mode: "audience", include: included, exclude: excluded, excludedFanIds, workflowId }) });
    if (assigned) {
      setFanId("");
      setWorkflowId("");
      setIncluded([]);
      setExcluded([]);
      setExcludedFanIds([]);
      if (assigned.audience) {
        setReadyEnrollmentIds(assigned.audience.enrollmentIds);
        setNotice(`${assigned.audience.matched} fans coincidieron: ${assigned.audience.ready} workflows están listos para iniciar y ${assigned.audience.unchanged} ya estaban activos.`);
      }
      else setNotice("Fan asignado correctamente.");
    }
  }

  async function previewAudience() {
    const result = await request("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "preview", include: included, exclude: excluded, excludedFanIds, workflowId }) });
    if (result?.preview) setPreview({ key: audienceKey, ...result.preview });
  }

  async function startAudience() {
    const result = await request("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "start", enrollmentIds: readyEnrollmentIds }) });
    if (!result?.start) return;
    setReadyEnrollmentIds([]);
    setNotice(`${result.start.started} workflows iniciados${result.start.failed ? `; ${result.start.failed} quedaron programados para reintento` : ""}.`);
  }

  async function cancelAudience() {
    const result = await request("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "cancel_unstarted", enrollmentIds: readyEnrollmentIds }) });
    if (!result?.cancellation) return;
    setReadyEnrollmentIds([]);
    setNotice(`${result.cancellation.cancelled} workflows sin iniciar fueron cancelados.`);
  }

  async function clearActivity() {
    if (!deleteScope) return;
    const cleared = await request("/api/workflow-activity", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: deleteScope }) });
    if (cleared) setDeleteScope(null);
  }

  return <section className="mt-8 rounded-2xl border border-white/8 bg-white/[.025] p-5"><div className="flex flex-col gap-4"><div><p className="text-xs font-medium uppercase tracking-[.16em] text-violet-400">Enrollments</p><h2 className="mt-1 text-xl font-semibold text-white">Asignaciones activas</h2><p className="mt-1 text-xs text-zinc-500">Asigna a un fan o construye una audiencia combinando inclusiones y exclusiones.</p></div><div className="inline-flex w-fit rounded-xl border border-white/10 bg-black/20 p-1"><button type="button" onClick={() => setDestination("fan")} className={`rounded-lg px-4 py-2 text-xs font-semibold ${destination === "fan" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>Un fan</button><button type="button" onClick={() => setDestination("audience")} className={`rounded-lg px-4 py-2 text-xs font-semibold ${destination === "audience" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>Una audiencia</button></div>{destination === "fan" ? <select value={fanId} onChange={(event) => setFanId(event.target.value)} className="max-w-md rounded-xl border border-white/10 bg-[#1b1d25] px-3 py-2.5 text-sm text-zinc-300"><option value="">Selecciona un fan</option>{fans.map((fan) => <option key={fan.id} value={fan.id}>{fan.name}{fan.username ? ` (@${fan.username})` : ""}</option>)}</select> : <AudiencePicker audiences={audiences} included={included} excluded={excluded} onInclude={setIncluded} onExclude={setExcluded} />}<div className="flex flex-col gap-2 sm:flex-row"><select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} className="min-w-64 rounded-xl border border-white/10 bg-[#1b1d25] px-3 py-2.5 text-sm text-zinc-300"><option value="">Selecciona un flujo</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select><button disabled={busy || !workflowId || (destination === "fan" ? !fanId : included.length === 0)} onClick={assign} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><UserPlus className="size-4" />{busy ? "Asignando…" : destination === "fan" ? "Asignar fan" : "Asignar audiencia"}</button></div></div>
    {destination === "audience" ? <><FanExclusionPicker fans={fans} selected={excludedFanIds} onChange={setExcludedFanIds} /><div className="mt-4 rounded-xl border border-white/8 bg-black/15 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-medium text-zinc-200">Vista previa de destinatarios</p><p className="mt-1 text-[11px] text-zinc-600">Calcula la audiencia después de aplicar exclusiones y reglas de reingreso.</p></div><button type="button" disabled={busy || !workflowId || included.length === 0} onClick={previewAudience} className="flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 px-4 py-2.5 text-sm font-semibold text-violet-300 hover:bg-violet-400/8 disabled:opacity-40"><Eye className="size-4" />Calcular audiencia</button></div>{preview?.key === audienceKey ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><PreviewMetric label="Coinciden" value={preview.matched} /><PreviewMetric label="Nuevos" value={preview.newAssignments} /><PreviewMetric label="Ya asignados" value={preview.alreadyReady} /><PreviewMetric label="Ya activos" value={preview.alreadyActive} /><PreviewMetric label="Omitidos" value={preview.skipped} />{preview.limited ? <p className="col-span-full mt-1 text-xs text-amber-300">La vista previa alcanzó el límite de 2,000 contactos.</p> : null}</div> : null}</div></> : null}
    {readyEnrollmentIds.length ? <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-violet-400/20 bg-violet-400/8 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-medium text-violet-100">Audiencia asignada, todavía sin iniciar</p><p className="mt-1 text-xs text-violet-200/60">Revisa el resultado y decide qué hacer con los {readyEnrollmentIds.length} workflows.</p></div><div className="flex shrink-0 flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={cancelAudience} className="flex items-center justify-center gap-2 rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-40"><XCircle className="size-4" />Cancelar todos</button><button type="button" disabled={busy} onClick={startAudience} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-40"><Play className="size-4" />{busy ? "Procesando…" : "Iniciar todos"}</button></div></div> : null}
    {error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p> : null}
    {notice ? <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}
    <div className="mt-5 rounded-xl border border-white/8 bg-black/15 p-4"><div><p className="text-sm font-medium text-zinc-200">Progreso general</p><p className="mt-1 text-[11px] text-zinc-600">Estado de todas las asignaciones de workflows.</p></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7"><ProgressMetric label="Asignados" value={enrollmentProgress.assigned} /><ProgressMetric label="Activos" value={enrollmentProgress.active} /><ProgressMetric label="Esperando" value={enrollmentProgress.waiting} /><ProgressMetric label="Pausados" value={enrollmentProgress.paused} /><ProgressMetric label="Completados" value={enrollmentProgress.completed} /><ProgressMetric label="Cancelados" value={enrollmentProgress.cancelled} /><ProgressMetric label="Fallidos" value={enrollmentProgress.failed} danger={enrollmentProgress.failed > 0} /></div></div>
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{enrollments.map((enrollment) => <article key={enrollment.id} className="rounded-xl border border-white/8 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-medium text-white">{enrollment.fanName}</h3><Status status={enrollment.status} hasStarted={enrollment.hasStarted} /></div><p className="mt-1 text-xs text-zinc-600">{enrollment.fanUsername ? `@${enrollment.fanUsername} · ` : ""}{enrollment.workflowName}</p></div><div className="flex flex-wrap items-center justify-end gap-1">{!enrollment.hasStarted ? <button type="button" disabled={busy} onClick={() => execute(enrollment.id)} className="flex items-center gap-1.5 rounded-lg bg-violet-500/12 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"><Zap className="size-3.5" />Iniciar workflow</button> : enrollment.status === "PAUSED" ? null : <span className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[.025] px-3 py-2 text-xs text-zinc-500"><Zap className={`size-3.5 ${enrollment.status === "ACTIVE" ? "animate-pulse text-emerald-400" : "text-sky-400"}`} />{enrollment.status === "WAITING" ? "Continuación automática" : "Procesando…"}</span>}{enrollment.hasStarted ? enrollment.status === "PAUSED" ? <Action icon={RotateCcw} label="Reanudar" disabled={busy} onClick={() => change(enrollment.id, "resume")} /> : <Action icon={Pause} label="Pausar" disabled={busy} onClick={() => change(enrollment.id, "pause")} /> : null}<Action icon={XCircle} label="Cancelar" disabled={busy} danger onClick={() => change(enrollment.id, "cancel")} /></div></div><div className="mt-3 rounded-lg bg-white/[.025] px-3 py-2 text-xs text-zinc-500"><span className="text-zinc-300">Paso actual:</span> {enrollment.currentStepName || "Sin paso"}{enrollment.nextRunAt ? ` · ${enrollment.status === "WAITING" ? "Espera hasta" : "Listo desde"} ${new Date(enrollment.nextRunAt).toLocaleString("es-MX")}` : !enrollment.hasStarted ? " · Todavía no iniciado" : enrollment.status === "PAUSED" && enrollment.pausedRemainingSeconds !== null ? ` · Quedaban ${formatRemaining(enrollment.pausedRemainingSeconds)}` : ""}{enrollment.pauseReason ? <p className="mt-1 text-amber-300/70">{enrollment.pauseReason}</p> : null}</div></article>)}{!enrollments.length ? <p className="col-span-full py-8 text-center text-sm text-zinc-600">No hay enrollments activos o pausados.</p> : null}</div>
    <div id="historial-workflows" className="mt-6 scroll-mt-20 border-t border-white/8 pt-5"><div className="flex items-center gap-2"><History className="size-4 text-violet-400" /><div><h3 className="text-sm font-medium text-white">Historial por fan</h3><p className="mt-0.5 text-[11px] text-zinc-600">Abre una ejecución para ver todo lo que ocurrió, paso por paso.</p></div></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{enrollmentHistory.map((entry) => <button key={entry.id} type="button" onClick={() => setHistoryEnrollment(entry)} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/15 px-4 py-3 text-left transition hover:border-violet-400/20 hover:bg-violet-400/[.04]"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-zinc-200">{entry.fanName}</p><HistoryStatus status={entry.status} /></div><p className="mt-1 truncate text-[11px] text-zinc-600">{entry.workflowName} · inició {new Date(entry.startedAt).toLocaleString("es-MX")}</p></div><span className="shrink-0 text-[11px] font-medium text-violet-300">Ver detalle</span></button>)}{!enrollmentHistory.length ? <p className="col-span-full py-5 text-center text-xs text-zinc-600">Todavía no hay ejecuciones.</p> : null}</div></div>
    <div className="mt-6 border-t border-white/8 pt-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><History className="size-4 text-violet-400" /><div><h3 className="text-sm font-medium text-white">Actividad reciente</h3><p className="mt-0.5 text-[11px] text-zinc-600">Mostrando hasta 20 de {activityCounts.all} registros</p></div></div><button type="button" disabled={busy || activityCounts.all === 0} onClick={() => setDeleteScope(activityCounts.olderThan90Days > 0 ? "older_than_90_days" : "all")} className="flex items-center gap-2 rounded-lg border border-red-400/15 px-3 py-2 text-xs font-medium text-red-300/80 hover:bg-red-400/8 disabled:opacity-40"><Trash2 className="size-3.5" />Limpiar historial</button></div><div className="mt-3 space-y-2">{activity.map((entry) => <div key={entry.id} className="flex flex-col justify-between gap-1 rounded-xl bg-black/15 px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0"><p className="text-xs text-zinc-300">{entry.explanation}</p>{entry.fanName ? <p className="mt-1 text-[11px] text-zinc-600">Fan: {entry.fanName}</p> : null}</div><time className="shrink-0 text-[11px] text-zinc-600" dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString("es-MX")}</time></div>)}{!activity.length ? <p className="py-5 text-center text-xs text-zinc-600">Todavía no hay actividad de workflows.</p> : null}</div></div>
    {deleteScope ? <ActivityDeleteDialog counts={activityCounts} scope={deleteScope} busy={busy} onScopeChange={setDeleteScope} onCancel={() => setDeleteScope(null)} onConfirm={clearActivity} /> : null}
    {historyEnrollment ? <EnrollmentHistoryDialog enrollment={historyEnrollment} onClose={() => setHistoryEnrollment(null)} /> : null}
  </section>;

  function change(id: string, action: "pause" | "resume" | "cancel") {
    return request(`/api/enrollments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  }

  function execute(id: string) {
    return request(`/api/enrollments/${id}/execute`, { method: "POST" });
  }
}

function PreviewMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-white/[.035] p-3"><p className="text-[10px] text-zinc-600">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p></div>; }
function ProgressMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className="rounded-lg border border-white/6 bg-white/[.025] p-3"><p className="text-[10px] text-zinc-600">{label}</p><p className={`mt-1 text-lg font-semibold ${danger ? "text-red-300" : "text-zinc-200"}`}>{value}</p></div>; }

function Action({ icon: Icon, label, disabled, danger, onClick }: { icon: typeof Play; label: string; disabled: boolean; danger?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} title={label} aria-label={label} className={`rounded-lg border border-white/8 p-2 ${danger ? "text-zinc-600 hover:text-red-300" : "text-zinc-500 hover:text-white"}`}><Icon className="size-4" /></button>;
}

function AudiencePicker({ audiences, included, excluded, onInclude, onExclude }: { audiences: AudienceOption[]; included: AudienceSegment[]; excluded: AudienceSegment[]; onInclude: (value: AudienceSegment[]) => void; onExclude: (value: AudienceSegment[]) => void }) {
  function toggle(segment: AudienceSegment, target: "include" | "exclude") {
    if (target === "include") {
      onInclude(included.includes(segment) ? included.filter((item) => item !== segment) : [...included, segment]);
      onExclude(excluded.filter((item) => item !== segment));
    } else {
      onExclude(excluded.includes(segment) ? excluded.filter((item) => item !== segment) : [...excluded, segment]);
      onInclude(included.filter((item) => item !== segment));
    }
  }

  return <div className="grid gap-4 xl:grid-cols-2"><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.025] p-3"><div className="mb-3"><p className="text-sm font-medium text-emerald-200">Incluir</p><p className="text-[11px] text-zinc-600">El fan debe pertenecer al menos a una selección.</p></div><div className="grid gap-2 sm:grid-cols-2">{audiences.map((audience) => <AudienceChoice key={`include-${audience.id}`} audience={audience} checked={included.includes(audience.id)} disabled={excluded.includes(audience.id)} tone="include" onChange={() => toggle(audience.id, "include")} />)}</div></div><div className="rounded-xl border border-red-400/15 bg-red-400/[.025] p-3"><div className="mb-3"><p className="text-sm font-medium text-red-200">Excluir</p><p className="text-[11px] text-zinc-600">Se eliminan aunque también coincidan con una inclusión.</p></div><div className="grid gap-2 sm:grid-cols-2">{audiences.filter((audience) => audience.id !== "ALL_CONTACTS").map((audience) => <AudienceChoice key={`exclude-${audience.id}`} audience={audience} checked={excluded.includes(audience.id)} disabled={included.includes(audience.id)} tone="exclude" onChange={() => toggle(audience.id, "exclude")} />)}</div></div></div>;
}

function AudienceChoice({ audience, checked, disabled, tone, onChange }: { audience: AudienceOption; checked: boolean; disabled: boolean; tone: "include" | "exclude"; onChange: () => void }) {
  const selected = tone === "include" ? "border-emerald-400/40 bg-emerald-400/10" : "border-red-400/40 bg-red-400/10";
  return <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition ${checked ? selected : "border-white/8 bg-black/15 hover:border-white/15"} ${disabled ? "cursor-not-allowed opacity-35" : ""}`}><span className="min-w-0"><span className="block text-xs font-medium text-zinc-200">{audience.label}</span><span className="mt-0.5 block text-[10px] text-zinc-600">{audience.count} contactos</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className={`size-4 ${tone === "include" ? "accent-emerald-500" : "accent-red-500"}`} /></label>;
}

function FanExclusionPicker({ fans, selected, onChange }: { fans: FanOption[]; selected: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("es-MX");
  const matches = normalized ? fans.filter((fan) => `${fan.name} ${fan.username ?? ""}`.toLocaleLowerCase("es-MX").includes(normalized)).slice(0, 8) : [];
  const selectedFans = selected.flatMap((id) => { const fan = fans.find((candidate) => candidate.id === id); return fan ? [fan] : []; });

  return <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[.025] p-4"><div><p className="text-sm font-medium text-amber-100">Excluir fans específicos</p><p className="mt-1 text-[11px] text-zinc-600">Estas personas no recibirán el workflow aunque pertenezcan a una audiencia incluida.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o usuario…" className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-amber-400/30" />{matches.length ? <div className="mt-2 overflow-hidden rounded-lg border border-white/8 bg-[#1b1d25]">{matches.map((fan) => { const active = selected.includes(fan.id); return <button key={fan.id} type="button" onClick={() => { if (!active) onChange([...selected, fan.id]); setQuery(""); }} disabled={active} className="flex w-full items-center justify-between border-b border-white/5 px-3 py-2 text-left last:border-0 hover:bg-white/5 disabled:opacity-40"><span><span className="block text-xs text-zinc-200">{fan.name}</span>{fan.username ? <span className="block text-[10px] text-zinc-600">@{fan.username}</span> : null}</span><span className="text-[10px] font-semibold text-amber-300">{active ? "Excluido" : "Excluir"}</span></button>; })}</div> : normalized ? <p className="mt-2 text-xs text-zinc-600">No se encontraron fans.</p> : null}{selectedFans.length ? <div className="mt-3 flex flex-wrap gap-2">{selectedFans.map((fan) => <button key={fan.id} type="button" onClick={() => onChange(selected.filter((id) => id !== fan.id))} className="rounded-full border border-amber-400/20 bg-amber-400/8 px-3 py-1.5 text-xs text-amber-100 hover:bg-red-400/10 hover:text-red-200" title="Quitar exclusión">{fan.name} <span className="ml-1 text-amber-300/60">×</span></button>)}</div> : null}</div>;
}

function Status({ status, hasStarted }: { status: EnrollmentView["status"]; hasStarted: boolean }) {
  const label = !hasStarted ? "Asignado" : status === "ACTIVE" ? "Ejecutando" : status === "WAITING" ? "Esperando" : "Pausado";
  const style = !hasStarted ? "bg-zinc-400/10 text-zinc-300" : status === "ACTIVE" ? "bg-emerald-400/10 text-emerald-300" : status === "WAITING" ? "bg-sky-400/10 text-sky-300" : "bg-amber-400/10 text-amber-300";
  return <span className={`rounded-full px-2 py-1 text-[10px] ${style}`}>{label}</span>;
}

function HistoryStatus({ status }: { status: EnrollmentHistorySummaryView["status"] }) {
  const labels = { ACTIVE: "Ejecutando", WAITING: "Esperando", PAUSED: "Pausado", COMPLETED: "Completado", CANCELLED: "Cancelado", FAILED: "Fallido" };
  const tone = status === "COMPLETED" ? "bg-emerald-400/10 text-emerald-300" : status === "FAILED" || status === "CANCELLED" ? "bg-red-400/10 text-red-300" : status === "PAUSED" ? "bg-amber-400/10 text-amber-300" : "bg-sky-400/10 text-sky-300";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${tone}`}>{labels[status]}</span>;
}

function formatRemaining(seconds: number) {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} horas`;
}

function translate(message: string) {
  const errors: Record<string, string> = { ENROLLMENT_ALREADY_ACTIVE: "El fan ya está en este workflow.", WORKFLOW_REENTRY_ONCE: "Este fan ya recorrió el workflow y la política permite ejecutarlo solo una vez.", WORKFLOW_REENTRY_COOLDOWN: "Este fan todavía está dentro del período de espera para volver a ingresar.", ENROLLMENT_FAN_NOT_FOUND: "El fan no está disponible.", ENROLLMENT_WORKFLOW_NOT_FOUND: "El workflow debe estar publicado.", ENROLLMENT_NOT_FOUND: "El enrollment no existe." };
  if (message.startsWith("ENROLLMENT_NOT_DUE:")) return `La espera todavía no termina. Podrás continuar el ${new Date(message.slice("ENROLLMENT_NOT_DUE:".length)).toLocaleString("es-MX")}.`;
  if (message.startsWith("STEP_NOT_IMPLEMENTED:")) return "Este tipo de paso todavía no tiene ejecución automática.";
  return errors[message] ?? (message.startsWith("Invalid enrollment transition") ? "Ese cambio de estado no está permitido." : message);
}
