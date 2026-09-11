/* eslint-disable @next/next/no-img-element -- Fanvue and local object URLs are dynamic. */
"use client";

import { Expand, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ExpandableImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const triggerElement = trigger.current;
    closeButton.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); triggerElement?.focus(); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-label={`Ampliar ${alt}`} onClick={() => setOpen(true)} className="group relative block w-full overflow-hidden text-left">
      <img src={src} alt={alt} loading="lazy" className={className} />
      <span aria-hidden="true" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100"><Expand className="size-4" /></span>
    </button>
    {open ? <div role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)} className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm">
      <button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Cerrar imagen" className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="size-5" /></button>
      <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] max-w-[94vw] rounded-lg object-contain shadow-2xl" />
    </div> : null}
  </>;
}
