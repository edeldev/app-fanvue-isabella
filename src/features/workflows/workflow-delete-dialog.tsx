"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import type { WorkflowView } from "./types";

export function WorkflowDeleteDialog({ workflow, busy, onCancel, onConfirm }: {
  workflow: WorkflowView;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasHistory = workflow.enrollments > 0;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-workflow-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-400/20 bg-[#191b22] shadow-2xl shadow-black/60">
      <div className="flex items-start justify-between p-5"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-400/10 text-red-300"><AlertTriangle className="size-5" /></div><div><h2 id="delete-workflow-title" className="font-semibold text-white">Eliminar workflow</h2><p className="mt-1 text-sm text-zinc-500">Esta acción no se puede deshacer.</p></div></div><button type="button" disabled={busy} onClick={onCancel} aria-label="Cerrar" className="rounded-lg p-2 text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
      <div className="border-y border-white/8 bg-black/15 px-5 py-4"><p className="text-sm text-zinc-300">Vas a eliminar <strong className="text-white">{workflow.name}</strong>.</p>{workflow.status === "PUBLISHED" && hasHistory ? <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200/80">Sus {workflow.enrollments} enrollments ya finalizaron o fueron cancelados. Se eliminarán junto con sus ejecuciones. Los registros generales de actividad permanecerán como evidencia.</p> : <p className="mt-2 text-xs text-zinc-600">No existen enrollments activos asociados a este workflow.</p>}</div>
      <div className="flex justify-end gap-2 p-5"><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5">Conservar</button><button type="button" disabled={busy} onClick={onConfirm} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"><Trash2 className="size-4" />{busy ? "Eliminando…" : "Eliminar definitivamente"}</button></div>
    </div>
  </div>;
}
