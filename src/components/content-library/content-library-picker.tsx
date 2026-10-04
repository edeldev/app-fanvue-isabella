/* eslint-disable @next/next/no-img-element -- Fanvue returns temporary signed thumbnails. */
"use client";

import { Check, Film, ImageIcon, LoaderCircle, PackageOpen, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import type { AttachedMedia } from "@/components/media-fields";

type LibraryAsset = AttachedMedia & { id: string; url?: string; isFavorite?: boolean };
type Pack = { id: string; name: string; status: string; priceMinor: number | null; assets: Array<{ id: string; name: string; type: string; fanvueContentId: string | null }>; stats: { total: number; photos: number; videos: number } };
type Organizer = { id: string; name: string; count: number };

export function ContentLibraryPicker({ selectedUuids, remaining, onClose, onAdd }: { selectedUuids: string[]; remaining: number; onClose: () => void; onAdd: (media: AttachedMedia[], suggestedPriceMinor?: number | null) => void }) {
  const [tab, setTab] = useState<"library" | "packs">("library");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Map<string, AttachedMedia>>(new Map());
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [category, setCategory] = useState("");
  const [collection, setCollection] = useState("");
  const [tag, setTag] = useState("");
  const [type, setType] = useState<"all" | "photos" | "videos" | "favorites" | "unused">("all");
  const [organizers, setOrganizers] = useState<{ categories: Organizer[]; collections: Organizer[]; tags: Organizer[] }>({ categories: [], collections: [], tags: [] });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: type, page: String(page), pageSize: "30" });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (collection) params.set("collection", collection);
      if (tag) params.set("tag", tag);
      const [libraryResponse, packsResponse] = await Promise.all([
        fetch(`/api/content-library?${params}`, { signal }),
        fetch("/api/content-packs", { signal }),
      ]);
      const [libraryBody, packsBody] = await Promise.all([libraryResponse.json(), packsResponse.json()]);
      if (!libraryResponse.ok || !packsResponse.ok) throw new Error("No se pudo abrir Content Library.");
      setAssets(libraryBody.items.flatMap((item: { id: string; uuid: string | null; name: string; mediaType: string; thumbnailUrl?: string; url?: string; isFavorite?: boolean }) => item.uuid ? [{ id: item.id, uuid: item.uuid, name: item.name, mediaType: item.mediaType, localUrl: item.url, thumbnailUrl: item.thumbnailUrl, isFavorite: item.isFavorite }] : []));
      setPacks(packsBody.packs);
      setPages(libraryBody.pagination.pages);
      setOrganizers(libraryBody.organizers);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) enqueueSnackbar(error instanceof Error ? error.message : "No se pudo abrir Content Library.", { variant: "error" });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [category, collection, page, query, tag, type]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);

  const visiblePacks = useMemo(() => packs.filter((pack) => !query.trim() || pack.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [packs, query]);
  const toggle = (uuid: string) => {
    const asset = assets.find((item) => item.uuid === uuid);
    if (!asset) return;
    const removing = selected.includes(asset.uuid);
    if (!removing && selected.length >= remaining) return;
    setSelected((current) => removing ? current.filter((value) => value !== asset.uuid) : [...current, asset.uuid]);
    setSelectedMedia((stored) => {
      const next = new Map(stored);
      if (removing) next.delete(asset.uuid);
      else next.set(asset.uuid, { uuid: asset.uuid, name: asset.name, mediaType: asset.mediaType, localUrl: asset.localUrl, thumbnailUrl: asset.thumbnailUrl });
      return next;
    });
  };
  const available = (items: AttachedMedia[]) => items.filter((item) => !selectedUuids.includes(item.uuid));

  function addPack(pack: Pack) {
    const media = available(pack.assets.flatMap((asset) => asset.fanvueContentId ? [{ uuid: asset.fanvueContentId, name: asset.name, mediaType: asset.type }] : []));
    if (!media.length) return enqueueSnackbar("Este Pack no tiene contenido nuevo disponible.", { variant: "info" });
    if (media.length > remaining) return enqueueSnackbar(`El Pack tiene ${media.length} archivos disponibles y solamente quedan ${remaining} espacios.`, { variant: "warning" });
    onAdd(media, pack.priceMinor);
  }

  function confirm() {
    const media = selected.map((uuid) => selectedMedia.get(uuid)).filter((item): item is AttachedMedia => Boolean(item));
    if (media.length) onAdd(media);
  }

  return <div className="fixed inset-0 z-[160] grid place-items-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Seleccionar desde Content Library"><div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15171d] shadow-2xl shadow-black/70"><header className="flex items-start justify-between gap-4 border-b border-white/8 p-5"><div><p className="text-[10px] font-medium uppercase tracking-[.16em] text-violet-300">Contenido de Isabella</p><h2 className="mt-1 text-lg font-semibold text-white">Agregar desde Content Library</h2><p className="mt-1 text-xs text-zinc-500">Selecciona archivos organizados o agrega un Pack completo.</p></div><button type="button" onClick={onClose} className="cursor-pointer rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-5" /></button></header><div className="border-b border-white/8 p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="flex rounded-xl border border-white/8 bg-black/15 p-1"><button type="button" onClick={() => setTab("library")} className={`cursor-pointer rounded-lg px-4 py-2 text-xs ${tab === "library" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>Mi contenido</button><button type="button" onClick={() => setTab("packs")} className={`cursor-pointer rounded-lg px-4 py-2 text-xs ${tab === "packs" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>Packs</button></div><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="size-4 text-zinc-600" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={tab === "library" ? "Buscar por nombre, categoría, tag, collection o Pack…" : "Buscar Pack…"} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>{tab === "library" ? <div className="mt-3 flex gap-2 overflow-x-auto"><PickerSelect label="Tipo" value={type} onChange={(value) => { setType(value as typeof type); setPage(1); }} options={[["all", "Todo"], ["photos", "Fotos"], ["videos", "Videos"], ["favorites", "Favoritos"], ["unused", "Sin usar"]]} /><PickerSelect label="Categoría" value={category} onChange={(value) => { setCategory(value); setPage(1); }} options={organizers.categories.map((item) => [item.id, item.name])} /><PickerSelect label="Collection" value={collection} onChange={(value) => { setCollection(value); setPage(1); }} options={organizers.collections.map((item) => [item.id, item.name])} /><PickerSelect label="Tag" value={tag} onChange={(value) => { setTag(value); setPage(1); }} options={organizers.tags.map((item) => [item.id, item.name])} /></div> : null}</div><main className="min-h-0 flex-1 overflow-y-auto p-4">{loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-8 animate-spin text-violet-400" /></div> : tab === "library" ? assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{assets.map((asset) => { const chosen = selected.includes(asset.uuid), disabled = selectedUuids.includes(asset.uuid); return <button key={asset.id} type="button" disabled={disabled} onClick={() => toggle(asset.uuid)} className={`overflow-hidden rounded-2xl border text-left transition disabled:cursor-not-allowed disabled:opacity-30 ${chosen ? "border-violet-400 ring-2 ring-violet-400/15" : "border-white/8 hover:border-white/20"}`}><div className="relative aspect-square bg-black/30">{asset.thumbnailUrl || asset.localUrl ? <img src={asset.thumbnailUrl ?? asset.localUrl} alt={asset.name} className="size-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-zinc-700">{asset.mediaType === "video" ? <Film /> : <ImageIcon />}</span>}{chosen ? <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-violet-500"><Check className="size-4" /></span> : null}</div><div className="p-2.5"><p className="truncate text-[11px] text-zinc-300">{asset.name}</p><p className="mt-1 text-[9px] uppercase text-zinc-600">{asset.mediaType === "video" ? "Video" : "Foto"}</p></div></button>; })}</div> : <Empty text="No hay contenido disponible con esos filtros." /> : visiblePacks.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visiblePacks.map((pack) => <article key={pack.id} className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="flex items-start justify-between"><PackageOpen className="size-5 text-violet-300" /><span className="text-[9px] uppercase text-zinc-600">{statusLabel(pack.status)}</span></div><h3 className="mt-3 truncate text-sm font-medium text-white">{pack.name}</h3><p className="mt-1 text-[11px] text-zinc-600">{pack.stats.total} assets · {pack.stats.photos} fotos · {pack.stats.videos} videos</p><button type="button" onClick={() => addPack(pack)} className="mt-4 w-full cursor-pointer rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white hover:bg-violet-400">Agregar Pack completo</button></article>)}</div> : <Empty text="No hay Packs disponibles con ese nombre." />}</main>{tab === "library" ? <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 p-4"><div className="flex items-center gap-3"><p className="text-xs text-zinc-500">{selected.length} seleccionados · {remaining} espacios disponibles</p>{pages > 1 ? <div className="flex gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/8 p-1.5 disabled:opacity-30">‹</button><span className="px-2 py-1.5 text-[10px] text-zinc-600">{page}/{pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/8 p-1.5 disabled:opacity-30">›</button></div> : null}</div><button type="button" disabled={!selected.length} onClick={confirm} className="cursor-pointer rounded-xl bg-violet-500 px-5 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">Agregar selección</button></footer> : null}</div></div>;
}

function PickerSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 shrink-0 rounded-xl border border-white/8 bg-[#20222b] px-3 text-xs text-zinc-400"><option value="">{label}</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>; }
function statusLabel(status: string) { return ({ DRAFT: "Borrador", READY: "Listo", ACTIVE: "Activo", ARCHIVED: "Archivado" } as Record<string, string>)[status] ?? status; }

function Empty({ text }: { text: string }) {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/8 text-center text-xs text-zinc-600">{text}</div>;
}
