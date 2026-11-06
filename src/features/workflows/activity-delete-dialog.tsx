"use client";

import { AlertTriangle, History, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export type ActivityDeleteScope = "older_than_90_days" | "all";

export function ActivityDeleteDialog({ counts, scope, busy, onScopeChange, onCancel, onConfirm }: { counts: { all: number; olderThan90Days: number }; scope: ActivityDeleteScope; busy: boolean; onScopeChange: (scope: ActivityDeleteScope) => void; onCancel: () => void; onConfirm: () => void }) {
  const selectedCount = scope === "all" ? counts.all : counts.olderThan90Days;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", close); };
  }, [busy, onCancel]);

  return createPortal(<div className="fixed inset-0 z-[500] grid place-items-center bg-black/80 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="clear-activity-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-rose-400/20 bg-[#11131a] shadow-[0_28px_100px_rgba(0,0,0,.72),0_0_45px_rgba(244,63,94,.08)]"><div className="absolute inset-x-14 top-0 h-px bg-gradient-to-r from-transparent via-rose-400 to-transparent" />
      <header className="flex items-start justify-between gap-4 border-b border-white/8 bg-gradient-to-br from-rose-500/[.07] to-transparent p-5 sm:p-6"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-rose-400/15 bg-rose-400/[.07] text-rose-300"><History className="size-5" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-rose-300">Administración de datos</p><h2 id="clear-activity-title" className="mt-1 text-lg font-semibold text-white">Limpiar actividad reciente</h2><p className="mt-1 text-xs text-zinc-500">Elige exactamente qué registros deseas eliminar.</p></div></div><button type="button" disabled={busy} onClick={onCancel} aria-label="Cerrar" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/8 text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></header>
      <div className="space-y-3 p-5 sm:p-6"><Choice checked={scope === "older_than_90_days"} title="Actividad antigua" detail={`${counts.olderThan90Days} registros con más de 90 días`} onClick={() => onScopeChange("older_than_90_days")} /><Choice checked={scope === "all"} title="Toda la actividad" detail={`${counts.all} registros de workflows`} onClick={() => onScopeChange("all")} danger /><div className="flex gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.035] p-3.5"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" /><p className="text-[11px] leading-5 text-zinc-500"><strong className="font-medium text-emerald-200">Tus datos principales están protegidos.</strong><br />Fans, mensajes, plantillas, workflows y asignaciones no se eliminarán.</p></div>{selectedCount === 0 ? <p className="text-center text-xs text-zinc-600">No existen registros dentro de esta selección.</p> : <div className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[.035] px-3 py-2.5 text-xs text-amber-200/80"><AlertTriangle className="size-4 shrink-0" />Se eliminarán {selectedCount} registros y no podrán recuperarse.</div>}</div>
      <footer className="flex flex-col-reverse gap-2 border-t border-white/8 bg-black/15 p-5 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onCancel} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5">Conservar historial</button><button type="button" disabled={busy || selectedCount === 0} onClick={onConfirm} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,.14)] disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="size-4" />{busy ? "Eliminando…" : `Eliminar ${selectedCount} registros`}</button></footer>
    </section>
  </div>, document.body);
}

function Choice({ checked, title, detail, onClick, danger }: { checked: boolean; title: string; detail: string; onClick: () => void; danger?: boolean }) { return <button type="button" role="radio" aria-checked={checked} onClick={onClick} className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition ${checked ? danger ? "border-rose-400/35 bg-rose-400/[.07] shadow-[0_0_20px_rgba(244,63,94,.06)]" : "border-violet-400/35 bg-violet-400/[.07] shadow-[0_0_20px_rgba(139,92,246,.06)]" : "border-white/8 bg-black/15 hover:border-white/15"}`}><span className={`grid size-5 shrink-0 place-items-center rounded-full border ${checked ? danger ? "border-rose-400" : "border-violet-400" : "border-zinc-700"}`}>{checked ? <span className={`size-2.5 rounded-full ${danger ? "bg-rose-400" : "bg-violet-400"}`} /> : null}</span><span><span className="block text-sm font-medium text-zinc-200">{title}</span><span className="mt-1 block text-xs text-zinc-600">{detail}</span></span></button>; }
