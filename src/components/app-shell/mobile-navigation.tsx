"use client";

import { Gauge, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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

  return <div className="lg:hidden">
    <button type="button" aria-label="Abrir navegación" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white"><Menu className="size-5" /></button>
    {open ? <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <aside id="mobile-navigation" className="relative flex h-full w-[min(19rem,86vw)] flex-col border-r border-white/10 bg-[#0b0d12] p-4 shadow-2xl shadow-black/70">
        <div className="mb-7 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white"><Gauge className="size-5" /></span><div><h2 id={titleId} className="text-sm font-semibold text-white">Fanvue CRM</h2><p className="text-[10px] text-zinc-500">Navegación principal</p></div></div><button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="grid size-10 place-items-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"><X className="size-5" /></button></div>
        <SidebarNavigation onNavigate={() => setOpen(false)} />
      </aside>
    </div> : null}
  </div>;
}
