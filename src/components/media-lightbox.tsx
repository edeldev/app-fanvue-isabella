/* eslint-disable @next/next/no-img-element -- Fanvue and local object URLs are dynamic. */
"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function MediaLightbox({
  src,
  type,
  name,
  poster,
  onClose,
}: {
  src: string;
  type: "image" | "video";
  name: string;
  poster?: string;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada de ${name}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[400] grid place-items-center bg-black/95 p-4 backdrop-blur-md"
    >
      <button
        ref={closeButton}
        type="button"
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
        className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-white/10 bg-black/70 text-white shadow-xl hover:bg-white/15"
      >
        <X className="size-5" />
      </button>
      {type === "video" ? (
        <video
          src={src}
          poster={poster}
          controls
          autoPlay
          playsInline
          onMouseDown={(event) => event.stopPropagation()}
          className="max-h-[90dvh] max-w-[94vw] rounded-xl bg-black object-contain shadow-2xl"
        />
      ) : (
        <img
          src={src}
          alt={name}
          onMouseDown={(event) => event.stopPropagation()}
          className="max-h-[90dvh] max-w-[94vw] rounded-xl object-contain shadow-2xl"
        />
      )}
    </div>,
    document.body,
  );
}

export type LightboxMedia = {
  id: string;
  src: string;
  type: "image" | "video";
  name: string;
  poster?: string;
};

export function MediaGalleryLightbox({
  items,
  initialIndex,
  onClose,
}: {
  items: LightboxMedia[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const item = items[index] ?? items[0];
  const closeButton = useRef<HTMLButtonElement>(null);
  const previous = () => setIndex((current) => (current - 1 + items.length) % items.length);
  const next = () => setIndex((current) => (current + 1) % items.length);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (items.length > 1 && event.key === "ArrowLeft") setIndex((current) => (current - 1 + items.length) % items.length);
      if (items.length > 1 && event.key === "ArrowRight") setIndex((current) => (current + 1) % items.length);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [items.length, onClose]);

  if (!item) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Galería de ${item.name}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[400] grid place-items-center bg-black/95 p-4 backdrop-blur-md">
      <button ref={closeButton} type="button" onClick={onClose} aria-label="Cerrar galería" className="absolute right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-white/10 bg-black/70 text-white shadow-xl hover:bg-white/15"><X className="size-5" /></button>
      {items.length > 1 ? <span className="absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">{index + 1} / {items.length}</span> : null}
      {item.type === "video" ? <video key={item.id} src={item.src} poster={item.poster} controls autoPlay playsInline onMouseDown={(event) => event.stopPropagation()} className="max-h-[88dvh] max-w-[90vw] rounded-xl bg-black object-contain shadow-2xl" /> : <img key={item.id} src={item.src} alt={item.name} onMouseDown={(event) => event.stopPropagation()} className="max-h-[88dvh] max-w-[90vw] rounded-xl object-contain shadow-2xl" />}
      {items.length > 1 ? <><button type="button" onClick={previous} aria-label="Archivo anterior" className="absolute left-3 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/70 text-white shadow-xl hover:bg-violet-500 sm:left-6"><ChevronLeft className="size-7" /></button><button type="button" onClick={next} aria-label="Archivo siguiente" className="absolute right-3 top-1/2 z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/70 text-white shadow-xl hover:bg-violet-500 sm:right-6"><ChevronRight className="size-7" /></button></> : null}
    </div>,
    document.body,
  );
}
