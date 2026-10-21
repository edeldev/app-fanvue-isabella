/* eslint-disable @next/next/no-img-element -- Fanvue provides temporary signed thumbnails. */
"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  GripVertical,
  Film,
  ImageIcon,
  Images,
  LoaderCircle,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { enqueueSnackbar } from "notistack";
import { downloadArchive } from "@/lib/client/download-archive";
import type { AttachedMedia } from "@/components/media-fields";
import { VaultMediaPicker } from "@/components/vault-media-picker";

type Asset = { id: string; name: string; type: string; fanvueContentId?: string | null; url?: string; thumbnailUrl?: string; position?: number };
type Pack = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  priceMinor: number | null;
  coverContentId: string | null;
  coverUrl?: string;
  assets: Asset[];
  stats: { total: number; photos: number; videos: number };
  category: { id: string; name: string } | null;
};
type Data = {
  packs: Pack[];
  categories: Array<{ id: string; name: string }>;
  assets: Asset[];
};
const types = [
  "PHOTO_PACK",
  "VIDEO_PACK",
  "PHOTO_VIDEO",
  "PPV",
  "SUBSCRIBER",
  "PREMIUM",
  "BUNDLE",
  "CUSTOM",
];

function packCardPreview(pack: Pack) {
  const featured = pack.assets.find((asset) => asset.id === pack.coverContentId);
  const ordered = featured ? [featured, ...pack.assets.filter((asset) => asset.id !== featured.id)] : pack.assets;
  const visibleCount = ordered.length > 4 ? 3 : ordered.length;
  return { visible: ordered.slice(0, visibleCount), remaining: ordered.length - visibleCount };
}

export function PackManager({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Pack | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/content-packs");
      const body = await response.json();
      if (!response.ok) throw new Error();
      setData(body);
      const target = new URLSearchParams(window.location.search).get("pack");
      if (target)
        setEditing(body.packs.find((pack: Pack) => pack.id === target) ?? null);
    } catch {
      enqueueSnackbar("No se pudieron cargar los Packs.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function importMedia(media: AttachedMedia[]) {
    const response = await fetch("/api/content-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", media: media.map((item) => ({ uuid: item.uuid, name: item.name, mediaType: item.mediaType })) }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "No se pudo agregar el contenido.");
    await load();
    return (Array.isArray(body.items) ? body.items : []) as Asset[];
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/content-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        type: form.get("type"),
        categoryId: form.get("categoryId") || null,
        priceMinor: form.get("price")
          ? Math.round(Number(form.get("price")) * 100)
          : null,
        contentIds: selected,
      }),
    });
    const body = await response.json();
    if (!response.ok)
      return enqueueSnackbar(body.error || "No se pudo crear.", {
        variant: "error",
      });
    setCreating(false);
    setSelected([]);
    enqueueSnackbar("Pack creado.", { variant: "success" });
    await load();
  }
  async function duplicate(id: string) {
    const response = await fetch("/api/content-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", id }),
    });
    if (!response.ok)
      return enqueueSnackbar("No se pudo duplicar.", { variant: "error" });
    enqueueSnackbar("Pack duplicado sin copiar archivos.", {
      variant: "success",
    });
    await load();
  }
  async function remove(id: string) {
    if (
      !window.confirm(
        "¿Eliminar el Pack? Los assets permanecerán en Content Library.",
      )
    )
      return;
    const response = await fetch(`/api/content-packs/${id}`, {
      method: "DELETE",
    });
    if (!response.ok)
      return enqueueSnackbar("No se pudo eliminar.", { variant: "error" });
    setEditing(null);
    await load();
  }

  return (
    <>
      <header className={`${embedded ? "mb-5 rounded-2xl border border-white/8 bg-white/[.025] p-4 sm:p-5" : "mb-7"} flex flex-col justify-between gap-4 sm:flex-row sm:items-end`}>
        <div>
          {!embedded ? <Link href="/content-library" className="text-xs text-violet-300">
            ← Content Library
          </Link> : null}
          <h1 className={`${embedded ? "text-xl" : "mt-2 text-3xl"} font-semibold text-white`}>Packs</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Agrupa contenido, define portadas y prepara productos sin duplicar archivos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold"
        >
          <Plus className="size-4" />
          Crear Pack
        </button>
      </header>
      {loading ? (
        <div className="grid min-h-80 place-items-center">
          <LoaderCircle className="size-8 animate-spin text-violet-400" />
        </div>
      ) : data?.packs.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.packs.map((pack) => {
            const preview = packCardPreview(pack);
            return (
            <article
              key={pack.id}
              className="group overflow-hidden rounded-2xl border border-white/8 bg-[#15171d] transition hover:-translate-y-0.5 hover:border-violet-400/25"
            >
              <button
                type="button"
                onClick={() => setEditing(pack)}
                className="relative block aspect-[16/9] w-full cursor-pointer overflow-hidden bg-gradient-to-br from-violet-950/50 to-black/30 text-left"
              >
                {preview.visible.length ? (
                  <span className={`grid size-full gap-1 p-1 ${pack.assets.length >= 4 ? "grid-cols-2 grid-rows-2" : pack.assets.length === 3 ? "grid-cols-3" : pack.assets.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {preview.visible.map((asset) => (
                      <span key={asset.id} className="relative min-h-0 overflow-hidden rounded-lg bg-black/35">
                        <PackAssetPreview asset={asset} compact />
                        {asset.type === "video" ? <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/75 p-1 text-white"><Film className="size-3.5" /></span> : null}
                      </span>
                    ))}
                    {preview.remaining > 0 ? <span className="grid min-h-0 place-items-center rounded-lg border border-white/10 bg-gradient-to-br from-violet-400/15 to-black/70 text-lg font-semibold text-white">+{preview.remaining}</span> : null}
                  </span>
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <PackageOpen className="size-10 text-violet-400/35" />
                  </span>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[9px] font-medium uppercase text-zinc-200 backdrop-blur">
                  {statusLabel(pack.status)}
                </span>
                {pack.priceMinor != null ? (
                  <span className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    ${(pack.priceMinor / 100).toFixed(2)}
                  </span>
                ) : null}
              </button>
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => setEditing(pack)}
                  className="w-full cursor-pointer text-left"
                >
                  <h2 className="truncate font-semibold text-white">
                    {pack.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-zinc-600">
                    {pack.description || "Pack sin descripción"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                    <span className="rounded-lg bg-white/[.04] px-2 py-1">
                      {pack.stats.total} assets
                    </span>
                    <span className="rounded-lg bg-white/[.04] px-2 py-1">
                      {pack.stats.photos} fotos
                    </span>
                    <span className="rounded-lg bg-white/[.04] px-2 py-1">
                      {pack.stats.videos} videos
                    </span>
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditing(pack)}
                    className="cursor-pointer text-xs font-medium text-violet-300"
                  >
                    Abrir Pack
                  </button>
                  <button
                    type="button"
                    onClick={() => void duplicate(pack.id)}
                    className="flex cursor-pointer items-center gap-1 text-xs text-zinc-500 hover:text-white"
                  >
                    <Copy className="size-3" />
                    Duplicar
                  </button>
                </div>
              </div>
            </article>
          ); })}
        </div>
      ) : (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-white/10 text-zinc-500">
          Todavía no hay Packs
        </div>
      )}
      {creating && data ? (
        <PackForm
          title="Crear Pack"
          categories={data.categories}
          assets={data.assets}
          selected={selected}
          onSelected={setSelected}
          onImport={importMedia}
          onSubmit={create}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editing && data ? (
        <PackEditor
          pack={editing}
          categories={data.categories}
          assets={data.assets}
          onImport={importMedia}
          onClose={() => setEditing(null)}
          onDelete={() => void remove(editing.id)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function statusLabel(status: string) {
  return (
    (
      {
        DRAFT: "Borrador",
        READY: "Listo",
        ACTIVE: "Activo",
        ARCHIVED: "Archivado",
      } as Record<string, string>
    )[status] ?? status
  );
}

function PackForm({
  title,
  categories,
  assets,
  selected,
  onSelected,
  onSubmit,
  onImport,
  onClose,
}: {
  title: string;
  categories: Data["categories"];
  assets: Asset[];
  selected: string[];
  onSelected: (ids: string[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onImport: (media: AttachedMedia[]) => Promise<Asset[]>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/75 p-3">
      <form
        onSubmit={onSubmit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#15171d] p-5"
      >
        <Header title={title} onClose={onClose} />
        <Fields categories={categories} />
        <AssetPicker
          assets={assets}
          selected={selected}
          onChange={onSelected}
          onImport={async (media) => {
            const imported = await onImport(media);
            onSelected([...new Set([...selected, ...imported.map((item) => item.id)])]);
          }}
        />
        <button className="mt-5 w-full cursor-pointer rounded-xl bg-violet-500 px-4 py-3 font-semibold">
          Crear con {selected.length} assets
        </button>
      </form>
    </div>
  );
}

function PackEditor({
  pack,
  categories,
  assets,
  onClose,
  onDelete,
  onSaved,
  onImport,
}: {
  pack: Pack;
  categories: Data["categories"];
  assets: Asset[];
  onClose: () => void;
  onDelete: () => void;
  onSaved: () => void;
  onImport: (media: AttachedMedia[]) => Promise<Asset[]>;
}) {
  const [ordered, setOrdered] = useState(pack.assets.map((asset) => asset.id));
  const [cover, setCover] = useState(pack.coverContentId ?? ordered[0] ?? "");
  const [dragged, setDragged] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<
    "all" | "photos" | "videos" | null
  >(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const move = (id: string, delta: number) =>
    setOrdered((current) => {
      const from = current.indexOf(id),
        to = from + delta;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  const drop = (target: string) => {
    if (!dragged || dragged === target) return;
    setOrdered((current) => {
      const next = current.filter((id) => id !== dragged);
      next.splice(next.indexOf(target), 0, dragged);
      return next;
    });
    setDragged(null);
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
    const response = await fetch(`/api/content-packs/${pack.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || null,
        type: form.get("type"),
        status: form.get("status"),
        categoryId: form.get("categoryId") || null,
        priceMinor: form.get("price")
          ? Math.round(Number(form.get("price")) * 100)
          : null,
        coverContentId: cover || null,
        contentIds: ordered,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
    enqueueSnackbar("Pack actualizado.", { variant: "success" });
    await onSaved();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo guardar.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }
  async function download(mode: "all" | "photos" | "videos") {
    if (!ordered.length || downloading) return;
    setDownloading(mode);
    setDownloadProgress(null);
    try {
      const filename =
        pack.name.trim().replace(/[^a-zA-Z0-9._ -]/g, "_") || "content-pack";
      await downloadArchive(ordered, filename, mode, setDownloadProgress);
      enqueueSnackbar("Pack descargado.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el Pack.",
        { variant: "error" },
      );
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/80 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={`Editar ${pack.name}`}>
      <form
        onSubmit={save}
        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#15171d] shadow-2xl shadow-black/70"
      >
        <div className="shrink-0 border-b border-white/8 bg-[#191b23] px-5 py-4 sm:px-7">
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Content Library / Packs</p><h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-white">{pack.name}</h2><p className="mt-1 text-xs text-zinc-500">Organiza el contenido, elige la portada y guarda los cambios.</p></div><button type="button" onClick={onClose} aria-label="Cerrar editor" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full border border-violet-400/20 bg-violet-400/8 px-3 py-1 text-violet-200">{ordered.length} archivos en el Pack</span><span className="rounded-full border border-white/10 px-3 py-1 text-zinc-400">{statusLabel(pack.status)}</span></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1 sm:px-7">
        <Fields pack={pack} categories={categories} />
        <section className="mt-5 rounded-2xl border border-violet-400/15 bg-violet-400/[.04] p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-white">Descargar Pack</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Genera un ZIP sin duplicar los archivos originales.
              </p>
            </div>
            {process.env.NODE_ENV === "development" ? <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Todo"],
                  ["photos", "Solo fotos"],
                  ["videos", "Solo videos"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!ordered.length || Boolean(downloading)}
                  onClick={() => void download(mode)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-violet-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {downloading === mode ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  {downloading === mode
                    ? downloadProgress === null
                      ? "Preparando…"
                      : `${downloadProgress}%`
                    : label}
                </button>
              ))}
            </div> : <p className="text-xs text-zinc-500">Descarga disponible solo en desarrollo local.</p>}
          </div>
        </section>
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-2xl border border-white/8 bg-black/10 p-3 sm:p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 px-1"><div><h3 className="text-sm font-semibold text-white">Archivos del Pack</h3><p className="mt-1 text-[11px] text-zinc-500">Arrastra o usa las flechas para ordenar. La portada se mostrará en la biblioteca.</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400">{ordered.length} en total</span></div>
            <div className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
            {ordered.map((id, index) => {
              const asset = assets.find((item) => item.id === id) ?? pack.assets.find((item) => item.id === id);
              if (!asset) return null;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragged(id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => drop(id)}
                  className={`group flex min-w-0 items-center gap-2 rounded-xl border px-2 py-2 transition-colors sm:gap-3 ${cover === id ? "border-violet-400/30 bg-violet-400/[.055]" : "border-white/8 bg-[#1b1d25] hover:border-white/15"}`}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-zinc-600 group-hover:text-zinc-400" />
                  <span className="block size-14 shrink-0 overflow-hidden rounded-lg border border-white/8"><PackAssetPreview asset={asset} compact /></span>
                  <div className="min-w-0 flex-1"><Link href={`/content-library?asset=${encodeURIComponent(id)}`} className="block truncate text-xs font-medium text-zinc-200 hover:text-violet-300" title="Abrir detalle del contenido">{asset.name}</Link><p className="mt-1 text-[10px] text-zinc-500">{String(index + 1).padStart(2, "0")} · {asset.type === "video" ? "Video" : "Foto"}</p></div>
                  <button
                    type="button"
                    onClick={() => setCover(id)}
                    aria-label={`${cover === id ? "Portada actual" : "Elegir como portada"}: ${asset.name}`}
                    aria-pressed={cover === id}
                    className={`shrink-0 cursor-pointer rounded-lg border px-2 py-1.5 text-[10px] font-medium transition ${cover === id ? "border-violet-400/30 bg-violet-500 text-white" : "border-white/10 text-zinc-400 hover:border-violet-400/30 hover:text-violet-300"}`}
                  >
                    {cover === id ? "Portada" : "Elegir portada"}
                  </button>
                  <div className="flex items-center gap-0.5 border-l border-white/10 pl-1 sm:pl-2"><button type="button" onClick={() => move(id, -1)} disabled={!index} aria-label={`Subir ${asset.name}`} className="grid size-7 cursor-pointer place-items-center rounded-lg text-zinc-400 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 sm:size-8"><ArrowUp className="size-4" /></button><button type="button" onClick={() => move(id, 1)} disabled={index === ordered.length - 1} aria-label={`Bajar ${asset.name}`} className="grid size-7 cursor-pointer place-items-center rounded-lg text-zinc-400 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 sm:size-8"><ArrowDown className="size-4" /></button></div>
                  <button type="button" onClick={() => { setOrdered((current) => current.filter((value) => value !== id)); if (cover === id) setCover(ordered.find((value) => value !== id) ?? ""); }} aria-label={`Quitar ${asset.name} del Pack`} title="Quitar del Pack (no borra el archivo)" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-zinc-500 transition hover:bg-red-400/10 hover:text-red-300"><Trash2 className="size-4" /></button>
                </div>
              );
            })}
            {!ordered.length ? <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500">El Pack aún no tiene archivos. Agrégalos desde el panel de la derecha.</div> : null}
            </div>
          </section>
          <aside className="min-w-0 rounded-2xl border border-white/8 bg-[#1b1d25] p-3 sm:p-4">
          <AssetPicker
            purpose="add"
            assets={assets.filter((asset) => !ordered.includes(asset.id))}
            selected={[]}
            onChange={(ids) =>
              setOrdered((current) => [
                ...current,
                ...ids.filter((id) => !current.includes(id)),
              ])
            }
            onImport={async (media) => {
              const imported = await onImport(media);
              setOrdered((current) => [...new Set([...current, ...imported.map((item) => item.id)])]);
            }}
          />
          </aside>
        </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-[#191b23] px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onDelete}
            className="cursor-pointer rounded-xl border border-red-400/15 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/8"
          >
            Eliminar Pack
          </button>
          <div className="flex items-center gap-2"><button type="button" onClick={onClose} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-white/5">Cancelar</button><button disabled={saving} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{saving ? "Guardando…" : "Guardar cambios"}</button></div>
        </div>
      </form>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex justify-between">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Fotos y videos pueden convivir en el mismo Pack.
        </p>
      </div>
      <button type="button" onClick={onClose}>
        <X />
      </button>
    </div>
  );
}
function Fields({
  categories,
  pack,
}: {
  categories: Data["categories"];
  pack?: Pack;
}) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-zinc-500">Nombre del Pack<input name="name" required defaultValue={pack?.name} placeholder="Ej. Pack lencería negra" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-zinc-200 outline-none focus:border-violet-400/40" /></label>
      <label className="text-xs text-zinc-500">Tipo de Pack<select name="type" defaultValue={pack?.type ?? "CUSTOM"} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#20222b] p-3 text-zinc-200 outline-none focus:border-violet-400/40">{types.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="text-xs text-zinc-500 sm:col-span-2">Descripción<textarea name="description" defaultValue={pack?.description ?? ""} placeholder="Explica qué contiene este Pack…" rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-zinc-200 outline-none focus:border-violet-400/40" /></label>
      <label className="text-xs text-zinc-500">Categoría<select name="categoryId" defaultValue={pack?.category?.id ?? ""} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#20222b] p-3 text-zinc-200 outline-none focus:border-violet-400/40"><option value="">Sin categoría</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-1.5 block text-[10px] leading-4 text-zinc-600">Los archivos del Pack aparecerán al filtrar esta categoría.</span></label>
      <label className="text-xs text-zinc-500">Precio sugerido (USD)<input name="price" type="number" min="0" step=".01" defaultValue={pack?.priceMinor != null ? pack.priceMinor / 100 : ""} placeholder="Ej. 12.00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-zinc-200 outline-none focus:border-violet-400/40" /></label>
      {pack ? (
        <label className="text-xs text-zinc-500">Estado<select name="status" defaultValue={pack.status} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#20222b] p-3 text-zinc-200 outline-none focus:border-violet-400/40">{["DRAFT", "READY", "ACTIVE", "ARCHIVED"].map((status) => <option key={status}>{status}</option>)}</select></label>
      ) : null}
    </div>
  );
}
function AssetPicker({
  assets,
  selected,
  onChange,
  onImport,
  purpose = "create",
}: {
  assets: Asset[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onImport: (media: AttachedMedia[]) => Promise<void>;
  purpose?: "create" | "add";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const visibleAssets = assets.filter((asset) => asset.name.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));

  async function addMedia(media: AttachedMedia[]) {
    if (!media.length || importing) return;
    setImporting(true);
    try {
      await onImport(media);
      enqueueSnackbar(`${media.length} ${media.length === 1 ? "archivo agregado" : "archivos agregados"} al Pack.`, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo agregar el contenido.", { variant: "error" });
    } finally {
      setImporting(false);
      setVaultOpen(false);
    }
  }

  async function uploadFromMac(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 10);
    event.target.value = "";
    if (!files.length) return;
    setImporting(true);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/media/upload", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudieron subir los archivos.");
      await onImport(body.media);
      enqueueSnackbar(`${body.media.length} ${body.media.length === 1 ? "archivo agregado" : "archivos agregados"} al Pack.`, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudieron subir los archivos.", { variant: "error" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={purpose === "create" ? "mt-5" : ""}>
      <div><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">{purpose === "add" ? "Agregar archivos" : "Seleccionar archivos"}</h3><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400">{assets.length} disponibles</span></div><p className="mt-1 text-[11px] leading-4 text-zinc-500">{purpose === "add" ? "Elige contenido de la biblioteca o importa más archivos." : `${selected.length} seleccionados para este Pack.`}</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={(event) => void uploadFromMac(event)} /><button type="button" disabled={importing} onClick={() => inputRef.current?.click()} className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.025] px-2 text-[11px] font-medium text-zinc-300 transition hover:border-violet-400/30 hover:bg-violet-400/5 disabled:opacity-40">{importing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}Desde Mac</button><button type="button" disabled={importing} onClick={() => setVaultOpen(true)} className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[.025] px-2 text-[11px] font-medium text-zinc-300 transition hover:border-violet-400/30 hover:bg-violet-400/5 disabled:opacity-40"><Images className="size-3.5" />Desde Fanvue</button></div>
      <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-violet-400/40"><Search className="size-4 text-zinc-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar archivo…" aria-label="Buscar archivo para el Pack" className="min-w-0 flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600" /></label>
      <div className="mt-3 grid max-h-[42dvh] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {visibleAssets.map((asset) => {
          const chosen = selected.includes(asset.id);
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() =>
                onChange(
                  chosen
                    ? selected.filter((id) => id !== asset.id)
                    : [...selected, asset.id],
                )
              }
              aria-label={`${chosen ? "Quitar" : "Agregar"} ${asset.name}`}
              aria-pressed={chosen}
              className={`group overflow-hidden rounded-xl border text-left text-xs transition ${chosen ? "border-violet-400 bg-violet-400/10 ring-2 ring-violet-400/10" : "border-white/8 bg-black/10 text-zinc-500 hover:border-violet-400/30 hover:bg-violet-400/5"}`}
            >
              <PackAssetPreview asset={asset} />
              <span className="block truncate px-2.5 py-2 text-[10px] text-zinc-400" title={asset.name}>{asset.name}</span>
            </button>
          );
        })}
        {!visibleAssets.length ? <p className="col-span-2 rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-zinc-500">{query ? "No hay archivos con ese nombre." : "No hay más archivos. Importa desde Mac o Fanvue."}</p> : null}
      </div>
      {vaultOpen ? <VaultMediaPicker selectedUuids={assets.flatMap((asset) => asset.fanvueContentId ? [asset.fanvueContentId] : [])} remaining={10} onClose={() => setVaultOpen(false)} onAdd={(media) => void addMedia(media)} /> : null}
    </div>
  );
}

function PackAssetPreview({ asset, compact = false }: { asset: Asset; compact?: boolean }) {
  const source = asset.thumbnailUrl ?? asset.url;
  const [state, setState] = useState<{ source?: string; status: "loading" | "loaded" | "error" }>({ source, status: source ? "loading" : "error" });
  const status = state.source === source ? state.status : source ? "loading" : "error";
  return <span className={`relative block overflow-hidden bg-black/30 ${compact ? "size-full" : "aspect-video size-full"}`}>{status === "loading" ? <span className="absolute inset-0 grid place-items-center text-zinc-600"><LoaderCircle className="size-5 animate-spin" /></span> : null}{status === "error" ? <span className="absolute inset-0 grid place-items-center text-zinc-700">{asset.type === "video" ? <Film className="size-5" /> : <ImageIcon className="size-5" />}</span> : null}{source ? asset.type === "video" && !asset.thumbnailUrl ? <video src={source} muted preload="metadata" onLoadedData={() => setState({ source, status: "loaded" })} onError={() => setState({ source, status: "error" })} className={`size-full object-cover ${status === "loaded" ? "opacity-100" : "opacity-0"}`} /> : <img src={source} alt={asset.name} loading="lazy" onLoad={() => setState({ source, status: "loaded" })} onError={() => setState({ source, status: "error" })} className={`size-full object-cover ${status === "loaded" ? "opacity-100" : "opacity-0"}`} /> : null}</span>;
}
