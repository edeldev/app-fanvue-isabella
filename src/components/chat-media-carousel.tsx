"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { ExpandableImage } from "@/components/expandable-image";
import { MediaGalleryLightbox, type LightboxMedia } from "@/components/media-lightbox";

type Media = {
  uuid: string;
  variantUuids: string[];
  mediaType: string;
  name: string | null;
  url?: string;
  priceMinor: number | null;
  purchasedAt: string | null;
};

export function ChatMediaCarousel({
  media,
  ppvPrice,
  previewUuid,
}: {
  media: Media[];
  ppvPrice: number | null;
  previewUuid: string | null;
}) {
  const orderedMedia = useMemo(() => {
    const previewIndex = media.findIndex(
      (item) =>
        item.uuid === previewUuid ||
        item.variantUuids.includes(previewUuid ?? ""),
    );
    if (previewIndex <= 0) return media;
    return [
      media[previewIndex],
      ...media.slice(0, previewIndex),
      ...media.slice(previewIndex + 1),
    ];
  }, [media, previewUuid]);
  const [index, setIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const item = orderedMedia[index];
  const galleryItems = useMemo(
    () => orderedMedia.flatMap<LightboxMedia>((entry) =>
      entry.url && (entry.mediaType === "image" || entry.mediaType === "video")
        ? [{ id: entry.uuid, src: entry.url, type: entry.mediaType, name: entry.name || (entry.mediaType === "video" ? "Video del mensaje" : "Imagen del mensaje") }]
        : [],
    ),
    [orderedMedia],
  );
  const openGallery = (uuid: string) => {
    const position = galleryItems.findIndex((entry) => entry.id === uuid);
    if (position >= 0) setGalleryIndex(position);
  };
  const isPreview =
    previewUuid === item.uuid || item.variantUuids.includes(previewUuid ?? "");
  const previous = () =>
    setIndex(
      (current) =>
        (current - 1 + orderedMedia.length) % orderedMedia.length,
    );
  const next = () =>
    setIndex((current) => (current + 1) % orderedMedia.length);
  return (
    <div className="relative overflow-hidden bg-black/30">
      <div className="grid min-h-52 place-items-center">
        {item.mediaType === "image" && item.url ? (
          <ExpandableImage
            src={item.url}
            alt={item.name || "Imagen del mensaje"}
            className="max-h-[420px] w-full object-contain"
            onExpand={() => openGallery(item.uuid)}
          />
        ) : item.mediaType === "video" && item.url ? (
          <div className="group relative w-full"><video src={item.url} controls preload="metadata" className="max-h-[420px] w-full bg-black object-contain" /><button type="button" onClick={() => openGallery(item.uuid)} aria-label={`Ampliar ${item.name || "video del mensaje"}`} className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur hover:bg-violet-500"><Expand className="size-4" /></button></div>
        ) : item.mediaType === "audio" && item.url ? (
          <audio
            src={item.url}
            controls
            preload="metadata"
            className="m-5 max-w-[calc(100%-2.5rem)]"
          />
        ) : item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-3 underline"
          >
            {item.name || "Abrir archivo"}
          </a>
        ) : (
          <div className="px-5 text-center">
            <p className="text-xs text-zinc-400">
              {item.name || "Contenido PPV"}
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              Fanvue no entregó una vista disponible.
            </p>
          </div>
        )}
      </div>
      {orderedMedia.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Archivo anterior"
            onClick={previous}
            className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/90"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Archivo siguiente"
            onClick={next}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/90"
          >
            <ChevronRight className="size-5" />
          </button>
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
            {index + 1}/{orderedMedia.length}
          </span>
        </>
      ) : null}
      {isPreview || ppvPrice !== null ? (
        <span
          className={`pointer-events-none absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-lg backdrop-blur ${isPreview ? "bg-emerald-500/90 text-white" : "bg-black/80 text-amber-200"}`}
        >
          {isPreview
            ? "👁 Vista gratuita"
            : `🔒 PPV · $${((item.priceMinor ?? ppvPrice ?? 0) / 100).toFixed(2)}`}
        </span>
      ) : null}
      {orderedMedia.length > 1 ? (
        <div className="absolute bottom-3 right-3 flex gap-1">
          {orderedMedia.map((entry, position) => (
            <button
              key={`${entry.uuid}-${position}`}
              type="button"
              aria-label={`Ver archivo ${position + 1}`}
              onClick={() => setIndex(position)}
              className={`size-1.5 rounded-full ${position === index ? "bg-white" : "bg-white/35"}`}
            />
          ))}
        </div>
      ) : null}
      {galleryIndex !== null ? <MediaGalleryLightbox items={galleryItems} initialIndex={galleryIndex} onClose={() => setGalleryIndex(null)} /> : null}
    </div>
  );
}
