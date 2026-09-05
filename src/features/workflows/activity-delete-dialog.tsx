"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";

export type ActivityDeleteScope = "older_than_90_days" | "all";

export function ActivityDeleteDialog({ counts, scope, busy, onScopeChange, onCancel, onConfirm }: {
  counts: { all: number; olderThan90Days: number };
  scope: ActivityDeleteScope;
  busy: boolean;
  onScopeChange: (scope: ActivityDeleteScope) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selectedCount = scope === "all" ? counts.all : counts.olderThan90Days;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="clear-activity-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-400/20 bg-[#191b22] shadow-2xl shadow-black/60">
      <div className="flex items-start justify-between p-5"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-400/10 text-red-300"><AlertTriangle className="size-5" /></div><div><h2 id="clear-activity-title" className="font-semibold text-white">Limpiar actividad</h2><p className="mt-1 text-sm text-zinc-500">Esta acción administrativa no se puede deshacer.</p></div></div><button type="button" disabled={busy} onClick={onCancel} aria-label="Cerrar" className="rounded-lg p-2 text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
      <div className="space-y-3 border-y border-white/8 bg-black/15 p-5">
        <Choice checked={scope === "older_than_90_days"} title="Actividad antigua" detail={`${counts.olderThan90Days} registros con más de 90 días`} onClick={() => onScopeChange("older_than_90_days")} />
        <Choice checked={scope === "all"} title="Toda la actividad" detail={`${counts.all} registros de workflows`} onClick={() => onScopeChange("all")} danger />
        <p className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200/80">Solo se borrará el historial de workflows. Tus fans, mensajes, plantillas, workflows y asignaciones no serán eliminados.</p>
      </div>
      <div className="flex justify-end gap-2 p-5"><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5">Conservar</button><button type="button" disabled={busy || selectedCount === 0} onClick={onConfirm} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-40"><Trash2 className="size-4" />{busy ? "Eliminando…" : `Eliminar ${selectedCount} registros`}</button></div>
    </div>
  </div>;
}

function Choice({ checked, title, detail, onClick, danger }: { checked: boolean; title: string; detail: string; onClick: () => void; danger?: boolean }) {
  return <button type="button" role="radio" aria-checked={checked} onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${checked ? danger ? "border-red-400/35 bg-red-400/8" : "border-violet-400/35 bg-violet-400/8" : "border-white/8 bg-white/[.02] hover:bg-white/[.04]"}`}><span className={`grid size-4 shrink-0 place-items-center rounded-full border ${checked ? danger ? "border-red-400" : "border-violet-400" : "border-zinc-600"}`}>{checked ? <span className={`size-2 rounded-full ${danger ? "bg-red-400" : "bg-violet-400"}`} /> : null}</span><span><span className="block text-sm font-medium text-zinc-200">{title}</span><span className="mt-0.5 block text-xs text-zinc-500">{detail}</span></span></button>;
}
