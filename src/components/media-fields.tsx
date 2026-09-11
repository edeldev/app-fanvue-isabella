"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, FolderOpen, ImageOff, ImagePlus, LoaderCircle, LockKeyhole, X } from "lucide-react";
import { ExpandableImage } from "@/components/expandable-image";
import { enqueueSnackbar } from "notistack";
import { VaultMediaPicker } from "@/components/vault-media-picker";

export type AttachedMedia = {
  uuid: string;
  name: string;
  mediaType: string;
  localUrl?: string;
};

export function MediaFields({
  initialMedia = [],
  initialPriceMinor = null,
  initialPreviewUuid = null,
}: {
  initialMedia?: AttachedMedia[];
  initialPriceMinor?: number | null;
  initialPreviewUuid?: string | null;
}) {
  const [media, setMedia] = useState<AttachedMedia[]>(initialMedia);
  const [price, setPrice] = useState(
    initialPriceMinor ? (initialPriceMinor / 100).toFixed(2) : "",
  );
  const [previewUuid, setPreviewUuid] = useState(initialPreviewUuid ?? "");
  const [uploading, setUploading] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [resolvingMedia, setResolvingMedia] = useState(initialMedia.some((item) => !item.localUrl));
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

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
          media: Array<{ uuid: string; url: string }>;
        }>;
      })
      .then((result) => {
        const urls = new Map(result.media.map((item) => [item.uuid, item.url]));
        setMedia((current) =>
          current.map((item) => ({
            ...item,
            localUrl: item.localUrl ?? urls.get(item.uuid),
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((item, index) => {
            const preview = Boolean(price && previewUuid === item.uuid);
            return (
              <div
                key={`${item.uuid}-${index}`}
                className={`relative overflow-hidden rounded-xl border bg-black/30 transition ${preview ? "border-emerald-400/70 ring-2 ring-emerald-400/15" : "border-white/10"}`}
              >
                {item.localUrl && item.mediaType === "image" ? (
                  <ExpandableImage
                    src={item.localUrl}
                    alt={item.name}
                    className="h-28 w-full object-cover"
                  />
                ) : item.localUrl && item.mediaType === "video" ? (
                  <video
                    src={item.localUrl}
                    controls
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className={`grid h-28 place-items-center px-2 text-center text-[10px] ${resolvingMedia ? "animate-pulse bg-gradient-to-br from-white/[.06] via-white/[.025] to-transparent text-zinc-500" : "text-zinc-600"}`}>
                    <span>{resolvingMedia ? <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" /> : <ImageOff className="mx-auto mb-2 size-5" />}{resolvingMedia ? "Cargando vista previa…" : "Vista previa no disponible"}</span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Quitar archivo"
                  onClick={() => remove(item.uuid)}
                  className="absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/75 text-white"
                >
                  <X className="size-3.5" />
                </button>
                {price ? (
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
              </div>
            );
          })}
        </div>
      ) : null}
      {media.length > 0 ? (
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
          <p className="mt-2 text-[11px] leading-4 text-zinc-500">
            {price
              ? "Todo queda bloqueado salvo el archivo que marques como vista previa gratuita."
              : "Sin precio, todos los archivos serán visibles gratuitamente."}
          </p>
        </div>
      ) : null}
      {vaultOpen ? <VaultMediaPicker selectedUuids={media.map((item) => item.uuid)} remaining={10 - media.length} onClose={() => setVaultOpen(false)} onAdd={(incoming) => { setMedia((current) => [...current, ...incoming].slice(0, 10)); setVaultOpen(false); enqueueSnackbar(`${incoming.length} ${incoming.length === 1 ? "archivo agregado" : "archivos agregados"} desde la bóveda.`, { variant: "success" }); }} /> : null}
    </div>
  );
}
