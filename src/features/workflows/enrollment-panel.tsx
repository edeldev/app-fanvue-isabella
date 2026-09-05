"use client";

import { useState } from "react";
import { History, Pause, Play, RotateCcw, UserPlus, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AutomationLogView, EnrollmentView, FanOption, WorkflowView } from "./types";

export function EnrollmentPanel({ fans, workflows, enrollments, activity }: { fans: FanOption[]; workflows: Pick<WorkflowView, "id" | "name">[]; enrollments: EnrollmentView[]; activity: AutomationLogView[] }) {
  const router = useRouter();
  const [fanId, setFanId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(url: string, options: RequestInit) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, options);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.refresh();
      return true;
    } catch (caught) {
      setError(translate(caught instanceof Error ? caught.message : "Error inesperado."));
      return false;
    } finally { setBusy(false); }
  }

  async function assign() {
    const assigned = await request("/api/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fanId, workflowId }) });
    if (assigned) {
      setFanId("");
      setWorkflowId("");
    }
  }

  return <section className="mt-8 rounded-2xl border border-white/8 bg-white/[.025] p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-medium uppercase tracking-[.16em] text-violet-400">Enrollments</p><h2 className="mt-1 text-xl font-semibold text-white">Asignaciones activas</h2><p className="mt-1 text-xs text-zinc-500">Inicia o reemplaza manualmente la estrategia principal de un fan.</p></div><div className="grid gap-2 sm:grid-cols-[220px_220px_auto]"><select value={fanId} onChange={(event) => setFanId(event.target.value)} className="rounded-xl border border-white/10 bg-[#1b1d25] px-3 py-2.5 text-sm text-zinc-300"><option value="">Selecciona un fan</option>{fans.map((fan) => <option key={fan.id} value={fan.id}>{fan.name}{fan.username ? ` (@${fan.username})` : ""}</option>)}</select><select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} className="rounded-xl border border-white/10 bg-[#1b1d25] px-3 py-2.5 text-sm text-zinc-300"><option value="">Selecciona un flujo</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select><button disabled={busy || !fanId || !workflowId} onClick={assign} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><UserPlus className="size-4" />Asignar</button></div></div>
    {error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p> : null}
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{enrollments.map((enrollment) => <article key={enrollment.id} className="rounded-xl border border-white/8 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-medium text-white">{enrollment.fanName}</h3><Status status={enrollment.status} /></div><p className="mt-1 text-xs text-zinc-600">{enrollment.fanUsername ? `@${enrollment.fanUsername} · ` : ""}{enrollment.workflowName}</p></div><div className="flex gap-1">{enrollment.status === "PAUSED" ? <Action icon={RotateCcw} label="Reanudar" disabled={busy} onClick={() => change(enrollment.id, "resume")} /> : <Action icon={Pause} label="Pausar" disabled={busy} onClick={() => change(enrollment.id, "pause")} />}<Action icon={XCircle} label="Cancelar" disabled={busy} danger onClick={() => change(enrollment.id, "cancel")} /></div></div><div className="mt-3 rounded-lg bg-white/[.025] px-3 py-2 text-xs text-zinc-500"><span className="text-zinc-300">Paso actual:</span> {enrollment.currentStepName || "Sin paso"}{enrollment.nextRunAt ? ` · ${enrollment.status === "WAITING" ? "Espera hasta" : "Próxima evaluación"} ${new Date(enrollment.nextRunAt).toLocaleString("es-MX")}` : ""}{enrollment.pauseReason ? <p className="mt-1 text-amber-300/70">{enrollment.pauseReason}</p> : null}</div></article>)}{!enrollments.length ? <p className="col-span-full py-8 text-center text-sm text-zinc-600">No hay enrollments activos o pausados.</p> : null}</div>
    <div className="mt-6 border-t border-white/8 pt-5"><div className="flex items-center gap-2"><History className="size-4 text-violet-400" /><h3 className="text-sm font-medium text-white">Actividad reciente</h3></div><div className="mt-3 space-y-2">{activity.map((entry) => <div key={entry.id} className="flex flex-col justify-between gap-1 rounded-xl bg-black/15 px-4 py-3 sm:flex-row sm:items-center"><div className="min-w-0"><p className="text-xs text-zinc-300">{entry.explanation}</p>{entry.fanName ? <p className="mt-1 text-[11px] text-zinc-600">Fan: {entry.fanName}</p> : null}</div><time className="shrink-0 text-[11px] text-zinc-600" dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString("es-MX")}</time></div>)}{!activity.length ? <p className="py-5 text-center text-xs text-zinc-600">Todavía no hay actividad de workflows.</p> : null}</div></div>
  </section>;

  function change(id: string, action: "pause" | "resume" | "cancel") {
    return request(`/api/enrollments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  }
}

function Action({ icon: Icon, label, disabled, danger, onClick }: { icon: typeof Play; label: string; disabled: boolean; danger?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} title={label} aria-label={label} className={`rounded-lg border border-white/8 p-2 ${danger ? "text-zinc-600 hover:text-red-300" : "text-zinc-500 hover:text-white"}`}><Icon className="size-4" /></button>;
}

function Status({ status }: { status: EnrollmentView["status"] }) {
  const label = status === "ACTIVE" ? "Activo" : status === "WAITING" ? "Esperando" : "Pausado";
  const style = status === "ACTIVE" ? "bg-emerald-400/10 text-emerald-300" : status === "WAITING" ? "bg-sky-400/10 text-sky-300" : "bg-amber-400/10 text-amber-300";
  return <span className={`rounded-full px-2 py-1 text-[10px] ${style}`}>{label}</span>;
}

function translate(message: string) {
  const errors: Record<string, string> = { ENROLLMENT_ALREADY_ACTIVE: "El fan ya está en este workflow.", ENROLLMENT_FAN_NOT_FOUND: "El fan no está disponible.", ENROLLMENT_WORKFLOW_NOT_FOUND: "El workflow debe estar publicado.", ENROLLMENT_NOT_FOUND: "El enrollment no existe." };
  return errors[message] ?? (message.startsWith("Invalid enrollment transition") ? "Ese cambio de estado no está permitido." : message);
}
