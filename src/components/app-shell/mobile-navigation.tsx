"use client";

import { Gauge, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { SidebarNavigation } from "./sidebar-navigation";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  const dialog = open ? createPortal(
    <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <aside id="mobile-navigation" className="relative flex h-dvh w-[min(19rem,86vw)] flex-col overflow-y-auto border-r border-violet-400/12 bg-[#0a0b10] p-4 shadow-[25px_0_80px_rgba(0,0,0,.75)]">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,.18),transparent_70%)]" />
        <div className="relative mb-7 flex items-center justify-between gap-3"><Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-violet-400/[.05]"><span className="grid size-10 place-items-center rounded-xl border border-violet-300/25 bg-linear-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(139,92,246,.22)]"><Gauge className="size-5" /></span><div><h2 id={titleId} className="text-sm font-semibold text-white">Fanvue CRM</h2><p className="text-[9px] font-medium uppercase tracking-[.15em] text-violet-300/55">Creator OS</p></div></Link><button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-xl border border-white/[.06] text-zinc-500 hover:border-violet-400/20 hover:bg-violet-400/[.06] hover:text-violet-200"><X className="size-5" /></button></div>
        <p className="relative mb-3 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-zinc-700">Workspace</p>
        <SidebarNavigation onNavigate={() => setOpen(false)} />
      </aside>
    </div>,
    document.body,
  ) : null;

  return <div className="lg:hidden">
    <button type="button" aria-label="Abrir navegación" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-white/[.075] bg-white/[.025] text-zinc-400 transition hover:border-violet-400/20 hover:bg-violet-400/[.06] hover:text-violet-200"><Menu className="size-5" /></button>
    {dialog}
  </div>;
}
