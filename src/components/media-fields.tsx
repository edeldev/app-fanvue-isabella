"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, Expand, Eye, FolderOpen, GripVertical, ImageOff, ImagePlus, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { ExpandableImage } from "@/components/expandable-image";
import { enqueueSnackbar } from "notistack";
import { VaultMediaPicker as VaultMediaPickerContent } from "@/components/vault-media-picker";
import { MediaLightbox } from "@/components/media-lightbox";
import { ContentLibraryPicker as ContentLibraryPickerContent } from "@/components/content-library/content-library-picker";

export type AttachedMedia = {
  uuid: string;
  name: string;
  mediaType: string;
  localUrl?: string;
  thumbnailUrl?: string;
};

export function MediaFields({
  initialMedia = [],
  initialPriceMinor = null,
  initialPreviewUuid = null,
  onValueChange,
  priceEnabled = true,
}: {
  initialMedia?: AttachedMedia[];
  initialPriceMinor?: number | null;
  initialPreviewUuid?: string | null;
  onValueChange?: (value: { media: AttachedMedia[]; priceMinor: number | null; previewUuid: string | null }) => void;
  priceEnabled?: boolean;
}) {
  const [media, setMedia] = useState<AttachedMedia[]>(initialMedia);
  const [price, setPrice] = useState(
    initialPriceMinor ? (initialPriceMinor / 100).toFixed(2) : "",
  );
  const [previewUuid, setPreviewUuid] = useState(initialPreviewUuid ?? "");
  const [uploading, setUploading] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [resolvingMedia, setResolvingMedia] = useState(initialMedia.some((item) => !item.localUrl));
  const objectUrls = useRef(new Set<string>());
  const onValueChangeRef = useRef(onValueChange);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const missingLockedMedia = Boolean(
    price && previewUuid && media.every((item) => item.uuid === previewUuid),
  );

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    const numericPrice = Number(price);
    onValueChangeRef.current?.({
      media: media.map(({ uuid, name, mediaType, localUrl, thumbnailUrl }) => ({ uuid, name, mediaType, localUrl, thumbnailUrl })),
      priceMinor: price && Number.isFinite(numericPrice) ? Math.round(numericPrice * 100) : null,
      previewUuid: price && previewUuid ? previewUuid : null,
    });
  }, [media, previewUuid, price]);

  useEffect(() => {
    const unresolved = initialMedia
      .filter((item) => !item.localUrl)
      .map((item) => item.uuid);
    if (unresolved.length === 0) return;
    const controller = new AbortController();
    void fetch(
      `/api/media/resolve?ids=${encodeURIComponent(unresolved.slice(0, 20).join(","))}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Media preview failed");
        return response.json() as Promise<{
          media: Array<{ uuid: string; url: string; thumbnailUrl?: string }>;
        }>;
      })
      .then((result) => {
        const urls = new Map(result.media.map((item) => [item.uuid, item.url]));
        setMedia((current) =>
          current.map((item) => ({
            ...item,
            localUrl: item.localUrl ?? urls.get(item.uuid),
            thumbnailUrl: item.thumbnailUrl ?? result.media.find((value) => value.uuid === item.uuid)?.thumbnailUrl,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setResolvingMedia(false); });
    return () => controller.abort();
  }, [initialMedia]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files)
      .slice(0, 10 - media.length)
      .forEach((file) => form.append("files", file));
    try {
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        media?: AttachedMedia[];
        error?: string;
      };
      if (!response.ok || !body.media)
        throw new Error(body.error || "No se pudieron subir los archivos.");
      const incoming = body.media.map((item, index) => {
        const localUrl = URL.createObjectURL(files[index]);
        objectUrls.current.add(localUrl);
        return { ...item, localUrl };
      });
      setMedia((current) => {
        const unique = new Map(
          [...current, ...incoming].map((item) => [item.uuid, item]),
        );
        return [...unique.values()].slice(0, 10);
      });
      enqueueSnackbar(`${incoming.length} ${incoming.length === 1 ? "archivo subido" : "archivos subidos"} correctamente.`, { variant: "success" });
    } catch (caught) {
      enqueueSnackbar(caught instanceof Error ? caught.message : "No se pudieron subir los archivos.", { variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  function remove(uuid: string) {
    const removed = media.find((item) => item.uuid === uuid);
    if (removed?.localUrl) {
      URL.revokeObjectURL(removed.localUrl);
      objectUrls.current.delete(removed.localUrl);
    }
    setMedia((current) => current.filter((item) => item.uuid !== uuid));
    if (previewUuid === uuid) setPreviewUuid("");
  }

  function move(uuid: string, offset: -1 | 1) {
    setMedia((current) => {
      const from = current.findIndex((item) => item.uuid === uuid);
      const to = from + offset;
      return from < 0 || to < 0 || to >= current.length
        ? current
        : arrayMove(current, from, to);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    setMedia((current) => {
      const from = current.findIndex((item) => item.uuid === event.active.id);
      const to = current.findIndex((item) => item.uuid === event.over?.id);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-black/10 p-3">
      <input
        type="hidden"
        name="mediaJson"
        value={JSON.stringify(
          media.map(({ uuid, name, mediaType }) => ({ uuid, name, mediaType })),
        )}
      />
      <input type="hidden" name="previewUuid" value={previewUuid} />
      <div><p className="text-xs font-medium text-zinc-400">Contenido multimedia <span className="font-normal text-zinc-700">(opcional)</span></p><p className="mt-1 text-[10px] leading-4 text-zinc-600">Sube archivos nuevos o reutiliza fotos y videos que ya existen en Fanvue.</p></div><div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/10">
          <ImagePlus className="size-4" />
          Agregar fotos o videos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            disabled={uploading || media.length >= 10}
            onChange={(event) => void upload(event.target.files)}
          />
        </label>
        <button type="button" disabled={uploading || media.length >= 10} onClick={() => setVaultOpen(true)} className="flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/[.06] px-3 py-2 text-xs text-violet-300 hover:bg-violet-400/10 disabled:opacity-40"><FolderOpen className="size-4" />Elegir de la bóveda</button>
        <button type="button" disabled={uploading || media.length >= 10} onClick={() => setLibraryOpen(true)} className="flex items-center gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[.06] px-3 py-2 text-xs text-fuchsia-200 hover:bg-fuchsia-400/10 disabled:opacity-40"><BookOpen className="size-4" />Mi Content Library</button>
        {uploading ? (
          <span className="flex items-center gap-2 text-xs text-violet-300">
            <LoaderCircle className="size-3.5 animate-spin" />
            Subiendo a Fanvue…
          </span>
        ) : (
          <span className="text-[11px] text-zinc-600">
            {media.length}/10 archivos
          </span>
        )}
      </div>
      {media.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={media.map((item) => item.uuid)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((item, index) => {
            const preview = Boolean(price && previewUuid === item.uuid);
            return (
              <SortableMediaCard
                key={item.uuid}
                id={item.uuid}
                index={index}
                total={media.length}
                preview={preview}
                onMove={(offset) => move(item.uuid, offset)}
              >
                {item.localUrl && item.mediaType === "image" ? (
                  <ExpandableImage
                    src={item.localUrl}
                    alt={item.name}
                    className="h-28 w-full object-cover"
                  />
                ) : item.localUrl && item.mediaType === "video" ? (
                  <VideoPreview src={item.localUrl} poster={item.thumbnailUrl} name={item.name} />
                ) : (
                  <div className={`grid h-28 place-items-center px-2 text-center text-[10px] ${resolvingMedia ? "animate-pulse bg-gradient-to-br from-white/[.06] via-white/[.025] to-transparent text-zinc-500" : "text-zinc-600"}`}>
                    <span>{resolvingMedia ? <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" /> : <ImageOff className="mx-auto mb-2 size-5" />}{resolvingMedia ? "Cargando vista previa…" : "Vista previa no disponible"}</span>
                  </div>
                )}
                <button type="button" aria-label="Quitar archivo" onClick={() => remove(item.uuid)} className="absolute right-1.5 top-1.5 z-20 grid size-7 cursor-pointer place-items-center rounded-full bg-black/75 text-white hover:bg-red-500"><X className="size-3.5" /></button>
                {priceEnabled && price ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUuid(preview ? "" : item.uuid)}
                    className={`flex w-full items-center justify-center gap-1.5 border-t px-2 py-2 text-[10px] font-medium ${preview ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/8 text-zinc-400 hover:bg-white/5"}`}
                  >
                    {preview ? (
                      <Eye className="size-3" />
                    ) : (
                      <LockKeyhole className="size-3" />
                    )}
                    {preview ? "Vista previa gratis" : "Contenido bloqueado"}
                  </button>
                ) : (
                  <p className="truncate border-t border-white/8 px-2 py-2 text-[10px] text-zinc-500">
                    {item.name}
                  </p>
                )}
              </SortableMediaCard>
            );
          })}
        </div>
        </SortableContext>
        </DndContext>
      ) : null}
      {media.length > 0 && priceEnabled ? (
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3">
          <label className="text-xs font-medium text-amber-200">
            Precio PPV en USD
            <input
              name="price"
              type="number"
              min="3"
              step="0.01"
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                if (!event.target.value) setPreviewUuid("");
              }}
              placeholder="Gratis"
              className="ml-3 w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50"
            />
          </label>
          <p className={`mt-2 text-[11px] leading-4 ${missingLockedMedia ? "font-medium text-red-300" : "text-zinc-500"}`}>
            {missingLockedMedia
              ? "Falta contenido bloqueado. Agrega otra foto o video, o quita el precio."
              : price
              ? "Todo queda bloqueado salvo el archivo que marques como vista previa gratuita."
              : "Sin precio, todos los archivos serán visibles gratuitamente."}
          </p>
        </div>
      ) : null}
      {vaultOpen ? <VaultMediaPicker selectedUuids={media.map((item) => item.uuid)} remaining={10 - media.length} onClose={() => setVaultOpen(false)} onAdd={(incoming) => { setMedia((current) => [...current, ...incoming].slice(0, 10)); setVaultOpen(false); enqueueSnackbar(`${incoming.length} ${incoming.length === 1 ? "archivo agregado" : "archivos agregados"} desde la bóveda.`, { variant: "success" }); }} /> : null}
      {libraryOpen ? <ContentLibraryPicker selectedUuids={media.map((item) => item.uuid)} remaining={10 - media.length} onClose={() => setLibraryOpen(false)} onAdd={(incoming, suggestedPriceMinor) => { setMedia((current) => [...new Map([...current, ...incoming].map((item) => [item.uuid, item])).values()].slice(0, 10)); if (!price && suggestedPriceMinor) setPrice((suggestedPriceMinor / 100).toFixed(2)); setLibraryOpen(false); enqueueSnackbar(`${incoming.length} ${incoming.length === 1 ? "archivo agregado" : "archivos agregados"} desde Content Library.`, { variant: "success" }); }} /> : null}
    </div>
  );
}

function SortableMediaCard({ id, index, total, preview, onMove, children }: { id: string; index: number; total: number; preview: boolean; onMove: (offset: -1 | 1) => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative overflow-hidden rounded-xl border bg-black/30 transition-shadow ${isDragging ? "z-30 scale-[1.02] border-violet-400 opacity-80 shadow-2xl shadow-black/60" : preview ? "border-emerald-400/70 ring-2 ring-emerald-400/15" : "border-white/10"}`}>
    <div className="absolute left-1.5 top-1.5 z-20 flex items-center gap-1 rounded-lg bg-black/75 p-1 text-white backdrop-blur">
      <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Mover archivo ${index + 1} a la izquierda`} className="grid size-6 cursor-pointer place-items-center rounded disabled:cursor-not-allowed disabled:opacity-25 hover:bg-white/15"><ArrowLeft className="size-3" /></button>
      <button type="button" {...attributes} {...listeners} aria-label={`Arrastrar archivo ${index + 1} de ${total}`} className="flex h-6 cursor-grab touch-none items-center gap-0.5 rounded px-1 text-[9px] active:cursor-grabbing hover:bg-white/15"><GripVertical className="size-3" />{index + 1}</button>
      <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Mover archivo ${index + 1} a la derecha`} className="grid size-6 cursor-pointer place-items-center rounded disabled:cursor-not-allowed disabled:opacity-25 hover:bg-white/15"><ArrowRight className="size-3" /></button>
    </div>
    {children}
  </div>;
}

function VideoPreview({ src, poster, name }: { src: string; poster?: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ src: string; status: "loading" | "loaded" | "error" }>({ src, status: "loading" });
  const status = state.src === src ? state.status : "loading";
  return <><button type="button" disabled={status !== "loaded"} onClick={() => setOpen(true)} aria-label={`Ampliar ${name}`} className="group relative block h-28 w-full overflow-hidden bg-black disabled:cursor-default">{status === "loading" ? <span className="absolute inset-0 z-10 grid animate-pulse place-items-center bg-gradient-to-br from-white/[.06] via-white/[.025] to-transparent text-zinc-500"><span className="text-center"><LoaderCircle className="mx-auto mb-2 size-5 animate-spin" /><span className="text-[10px]">Cargando video…</span></span></span> : null}{status === "error" ? <span className="absolute inset-0 z-10 grid place-items-center text-zinc-600"><span className="text-center"><ImageOff className="mx-auto mb-2 size-5" /><span className="text-[10px]">Vista previa no disponible</span></span></span> : null}<video src={src} poster={poster} muted playsInline preload="metadata" aria-label={name} onLoadedData={() => setState({ src, status: "loaded" })} onError={() => setState({ src, status: "error" })} className={`pointer-events-none h-28 w-full object-contain transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`} /><span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100"><Expand className="size-4" /></span></button>{open ? <MediaLightbox src={src} type="video" name={name} poster={poster} onClose={() => setOpen(false)} /> : null}</>;
}

function ContentLibraryPicker(props: ComponentProps<typeof ContentLibraryPickerContent>) {
  return createPortal(<ContentLibraryPickerContent {...props} />, document.body);
}

function VaultMediaPicker(props: ComponentProps<typeof VaultMediaPickerContent>) {
  return createPortal(<VaultMediaPickerContent {...props} />, document.body);
}
