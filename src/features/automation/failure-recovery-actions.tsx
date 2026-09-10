"use client";

import { LoaderCircle, Play, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "retry_now" | "resume_from_failed" | "cancel";

const content = {
  retry_now: { title: "Reintentar ahora", description: "Realiza un intento adicional del mismo paso en este momento.", confirm: "Reintentar ahora", icon: RefreshCw, danger: false },
  resume_from_failed: { title: "Reanudar desde el fallo", description: "Reinicia los intentos del paso fallido y deja que el cron continúe de forma automática.", confirm: "Reanudar workflow", icon: Play, danger: false },
  cancel: { title: "Cancelar definitivamente", description: "Detiene esta ejecución. El fan no continuará en este workflow.", confirm: "Cancelar definitivamente", icon: Trash2, danger: true },
} as const;

export function FailureRecoveryActions({ enrollmentId, workflowName, stepName }: { enrollmentId: string; workflowName: string; stepName: string }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}/recover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json();
      if (!response.ok) throw new Error(recoveryMessage(body.error));
      setAction(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo recuperar el workflow.");
    } finally {
      setBusy(false);
    }
  }

  const selected = action ? content[action] : null;
  const SelectedIcon = selected?.icon;
  return <>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => setAction("retry_now")} className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-[11px] font-semibold text-white hover:bg-violet-400"><RefreshCw className="size-3.5" />Reintentar ahora</button>
      <button type="button" onClick={() => setAction("resume_from_failed")} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-medium text-zinc-300 hover:bg-white/5"><RotateCcw className="size-3.5" />Reanudar desde el fallo</button>
      <button type="button" onClick={() => setAction("cancel")} className="flex items-center gap-1.5 rounded-lg border border-red-400/15 px-3 py-2 text-[11px] font-medium text-red-300 hover:bg-red-400/8"><Trash2 className="size-3.5" />Cancelar</button>
    </div>
    {selected && SelectedIcon ? <div role="dialog" aria-modal="true" aria-labelledby="recovery-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setAction(null); }} className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#181a21] shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 p-5"><div className={`grid size-10 place-items-center rounded-xl ${selected.danger ? "bg-red-400/10 text-red-300" : "bg-violet-400/10 text-violet-300"}`}><SelectedIcon className="size-5" /></div><button type="button" disabled={busy} onClick={() => setAction(null)} aria-label="Cerrar" className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
        <div className="p-5"><h2 id="recovery-title" className="text-lg font-semibold text-white">{selected.title}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{selected.description}</p><div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-zinc-500"><p className="font-medium text-zinc-300">{workflowName}</p><p className="mt-1">Paso fallido: {stepName}</p></div>{error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/8 p-3 text-xs text-red-200">{error}</p> : null}</div>
        <div className="flex justify-end gap-2 border-t border-white/8 p-5"><button type="button" disabled={busy} onClick={() => setAction(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5">Volver</button><button type="button" disabled={busy} onClick={confirm} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${selected.danger ? "bg-red-500 hover:bg-red-400" : "bg-violet-500 hover:bg-violet-400"}`}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <SelectedIcon className="size-4" />}{busy ? "Procesando…" : selected.confirm}</button></div>
      </div>
    </div> : null}
  </>;
}

function recoveryMessage(code: unknown) {
  if (code === "RECOVERY_SEND_STATUS_UNCERTAIN") return "Fanvue pudo haber recibido este mensaje. Se bloqueó el reintento para evitar un duplicado.";
  if (code === "RECOVERY_MESSAGE_ALREADY_SENT") return "Este mensaje ya figura como enviado y no puede repetirse.";
  if (code === "ENROLLMENT_NOT_FAILED") return "Este workflow ya no se encuentra fallido.";
  return typeof code === "string" ? code : "No se pudo recuperar el workflow.";
}
