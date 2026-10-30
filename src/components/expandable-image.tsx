/* eslint-disable @next/next/no-img-element -- Fanvue and local object URLs are dynamic. */
"use client";

import { Expand, ImageOff, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MediaLightbox } from "@/components/media-lightbox";

export function ExpandableImage({ src, alt, className = "", onExpand }: { src: string; alt: string; className?: string; onExpand?: () => void }) {
  const [open, setOpen] = useState(false);
  const [imageState, setImageState] = useState<{ src: string; status: "loading" | "loaded" | "error" }>({ src, status: "loading" });
  const status = imageState.src === src ? imageState.status : "loading";
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const triggerElement = trigger.current;
    return () => { triggerElement?.focus(); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" disabled={status !== "loaded"} aria-label={`Ampliar ${alt}`} onClick={() => onExpand ? onExpand() : setOpen(true)} className="group relative block w-full overflow-hidden bg-white/[.035] text-left disabled:cursor-default">
      {status === "loading" ? <span aria-label="Cargando imagen" className="absolute inset-0 grid animate-pulse place-items-center bg-gradient-to-br from-white/[.06] via-white/[.025] to-transparent text-zinc-600"><LoaderCircle className="size-5 animate-spin" /></span> : null}
      {status === "error" ? <span className="absolute inset-0 grid place-items-center text-zinc-600"><span className="text-center"><ImageOff className="mx-auto size-5" /><span className="mt-1 block text-[10px]">Vista previa no disponible</span></span></span> : null}
      <img src={src} alt={alt} loading="lazy" onLoad={() => setImageState({ src, status: "loaded" })} onError={() => setImageState({ src, status: "error" })} className={`${className} transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`} />
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 scale-90 place-items-center rounded-full border border-white/15 bg-black/70 text-white opacity-0 shadow-xl backdrop-blur-md transition duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"><Expand className="size-4" /></span>
    </button>
    {open && !onExpand ? <MediaLightbox src={src} type="image" name={alt} onClose={() => setOpen(false)} /> : null}
  </>;
}
