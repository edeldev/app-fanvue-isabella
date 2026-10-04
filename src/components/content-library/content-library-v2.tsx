/* eslint-disable @next/next/no-img-element -- Fanvue provides temporary signed media URLs. */
"use client";

import Link from "next/link";
import { Archive, Check, ChevronLeft, ChevronRight, Download, Film, FolderOpen, Grid2X2, Heart, ImageIcon, Images, Layers3, ListFilter, LoaderCircle, MoreHorizontal, PackageOpen, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AttachedMedia } from "@/components/media-fields";
import { VaultMediaPicker } from "@/components/vault-media-picker";
import { downloadArchive } from "@/lib/client/download-archive";

type View = "all" | "photos" | "videos" | "favorites" | "unused" | "used" | "unorganized" | "archived";
type Organizer = { id: string; name: string; count: number };
type Asset = { id: string; uuid: string | null; name: string; mediaType: "image" | "video"; isFavorite: boolean; isArchived: boolean; createdAt: string; category?: Organizer | null; collections?: Organizer[]; tags?: Organizer[]; packs?: Array<Organizer & { status?: string }>; templates?: Array<{ id: string; name: string }>; url?: string; thumbnailUrl?: string; width?: number | null; height?: number | null; durationMs?: number | null };
type LibraryData = { items: Asset[]; pagination: { page: number; pages: number; total: number }; counts: Record<View, number>; organizers: { categories: Organizer[]; collections: Organizer[]; tags: Organizer[]; packs: Organizer[] } };
type UploadItem = { name: string; status: "waiting" | "uploading" | "done" | "error" };

const views: Array<{ id: View; label: string; icon: typeof Images }> = [
  { id: "all", label: "Todo el contenido", icon: Images },
  { id: "photos", label: "Fotos", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Film },
  { id: "favorites", label: "Favoritos", icon: Heart },
  { id: "unused", label: "Sin usar", icon: Sparkles },
  { id: "used", label: "Usado en Packs", icon: PackageOpen },
  { id: "unorganized", label: "Sin organizar", icon: Layers3 },
  { id: "archived", label: "Archivado", icon: Archive },
];

export function ContentLibraryV2() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [view, setView] = useState<View>("all");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [collection, setCollection] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("collection") ?? "");
  const [tag, setTag] = useState("");
  const [pack, setPack] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("pack") ?? "");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [organizeSelection, setOrganizeSelection] = useState(false);
  const [packSelectionOpen, setPackSelectionOpen] = useState(false);
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null | undefined>(undefined);
  const [selectingAll, setSelectingAll] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, page: String(page), pageSize: "30" });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (collection) params.set("collection", collection);
      if (tag) params.set("tag", tag);
      if (pack) params.set("pack", pack);
      const target = new URLSearchParams(window.location.search).get("asset");
      if (target) params.set("asset", target);
      const response = await fetch(`/api/content-library?${params}`, { signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo cargar Content Library.");
      setData(body);
      if (target && body.items.some((item: Asset) => item.id === target)) setPreviewId(target);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) enqueueSnackbar(error instanceof Error ? error.message : "No se pudo cargar Content Library.", { variant: "error" });
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [category, collection, pack, page, query, tag, view]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 220); return () => { controller.abort(); window.clearTimeout(timer); }; }, [load]);

  async function importMedia(media: AttachedMedia[]) {
    const response = await fetch("/api/content-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", media: media.map(({ uuid, name, mediaType }) => ({ uuid, name, mediaType })) }) });
    const body = await response.json();
    if (!response.ok) return enqueueSnackbar(body.error || "No se pudo agregar el contenido.", { variant: "error" });
    enqueueSnackbar(`${body.imported} ${body.imported === 1 ? "archivo agregado" : "archivos agregados"}.`, { variant: "success" });
    setPage(1); await load();
  }

  async function uploadFiles(files: File[]) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]);
    const valid = files.filter((file) => allowed.has(file.type));
    if (!valid.length) return enqueueSnackbar("Selecciona JPG, PNG, WEBP, MP4, MOV o WEBM.", { variant: "warning" });
    const controller = new AbortController(); uploadAbort.current = controller;
    setUploads(valid.map((file) => ({ name: file.name, status: "waiting" })));
    const imported: AttachedMedia[] = [];
    for (let index = 0; index < valid.length; index += 1) {
      if (controller.signal.aborted) break;
      setUploads((current) => current.map((item, position) => position === index ? { ...item, status: "uploading" } : item));
      const form = new FormData(); form.append("files", valid[index]);
      try {
        const response = await fetch("/api/media/upload", { method: "POST", body: form, signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Error de subida");
        imported.push(...body.media);
        setUploads((current) => current.map((item, position) => position === index ? { ...item, status: "done" } : item));
      } catch { if (!controller.signal.aborted) setUploads((current) => current.map((item, position) => position === index ? { ...item, status: "error" } : item)); }
    }
    if (imported.length) await importMedia(imported);
    uploadAbort.current = null;
  }

  async function mutate(ids: string[], changes: Record<string, unknown> | "delete") {
    if (changes === "delete") {
      const response = await fetch("/api/content-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulkDelete", contentIds: ids }) });
      const body = await response.json();
      if (!response.ok) return enqueueSnackbar(body.error || "No se pudo eliminar la selección.", { variant: "error" });
      enqueueSnackbar(`${body.deleted} ${body.deleted === 1 ? "elemento eliminado" : "elementos eliminados"} de Content Library.`, { variant: "success" });
      setSelected(new Set());
      await load();
      return;
    }
    const responses = await Promise.all(ids.map((id) => fetch("/api/content-library", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...changes }) })));
    const failed = responses.filter((response) => !response.ok).length;
    enqueueSnackbar(failed ? `${failed} elementos no pudieron actualizarse.` : `${ids.length} ${ids.length === 1 ? "elemento actualizado" : "elementos actualizados"}.`, { variant: failed ? "warning" : "success" });
    if (!failed) setSelected(new Set());
    await load();
  }

  async function selectAllResults() {
    setSelectingAll(true);
    try {
      const params = new URLSearchParams({ view, idsOnly: "1" });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (collection) params.set("collection", collection);
      if (tag) params.set("tag", tag);
      if (pack) params.set("pack", pack);
      const response = await fetch(`/api/content-library?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudieron seleccionar los resultados.");
      setSelected(new Set(body.ids));
      enqueueSnackbar(`${body.ids.length} resultados seleccionados${body.limited ? " (límite de 5,000)" : ""}.`, { variant: body.limited ? "warning" : "success" });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudieron seleccionar los resultados.", { variant: "error" });
    } finally { setSelectingAll(false); }
  }

  async function createOrganizer(action: "createCategory" | "createCollection" | "createTag", name: string) {
    const response = await fetch("/api/content-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, name }) });
    const body = await response.json();
    if (!response.ok) return enqueueSnackbar(body.error || "No se pudo crear.", { variant: "error" });
    enqueueSnackbar("Organización creada.", { variant: "success" });
    await load();
  }

  async function downloadSelected() {
    setDownloadProgress(null);
    try {
      await downloadArchive(selectedIds, "selected-content", "all", setDownloadProgress);
      enqueueSnackbar("Descarga preparada.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo preparar la descarga.", { variant: "error" });
    } finally { setDownloadProgress(undefined); }
  }

  async function addSelectionToPack(packId: string) {
    const response = await fetch("/api/content-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addToPack", packId, contentIds: selectedIds }) });
    const body = await response.json();
    if (!response.ok) return enqueueSnackbar(body.error || "No se pudo agregar la selección al Pack.", { variant: "error" });
    setPackSelectionOpen(false);
    setSelected(new Set());
    enqueueSnackbar(body.added ? `${body.added} ${body.added === 1 ? "archivo agregado" : "archivos agregados"} al Pack.` : "Los archivos seleccionados ya estaban en ese Pack.", { variant: body.added ? "success" : "info" });
    await load();
  }

  async function organizeSelected(changes: Record<string, unknown>) {
    const response = await fetch("/api/content-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulkOrganize", contentIds: selectedIds, ...changes }) });
    const body = await response.json();
    if (!response.ok) return enqueueSnackbar(body.error || "No se pudo organizar la selección.", { variant: "error" });
    setOrganizeSelection(false);
    setSelected(new Set());
    enqueueSnackbar(`${body.updated} ${body.updated === 1 ? "archivo organizado" : "archivos organizados"}.`, { variant: "success" });
    await load();
  }

  const preview = data?.items.find((asset) => asset.id === previewId) ?? null;
  const selectedIds = [...selected];
  const toggleSelection = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const clearFilters = () => { setCategory(""); setCollection(""); setTag(""); setPack(""); setQuery(""); setPage(1); };
  const filtersActive = Boolean(category || collection || tag || pack || query);
  const completedUploads = uploads.filter((item) => item.status === "done" || item.status === "error").length;

  return <div className="overflow-hidden rounded-3xl border border-white/8 bg-[#15171d] shadow-2xl shadow-black/10">
    <div className="grid min-h-[680px] xl:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-b border-white/8 bg-black/10 p-3 xl:border-b-0 xl:border-r xl:p-4"><div className="flex gap-2 overflow-x-auto xl:block xl:space-y-1">{views.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setView(id); setPage(1); }} className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition xl:w-full ${view === id ? "bg-violet-500 text-white shadow-lg shadow-violet-950/20" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}><Icon className="size-4" /><span className="flex-1">{label}</span><span className={`text-[10px] ${view === id ? "text-violet-100" : "text-zinc-700"}`}>{data?.counts[id] ?? 0}</span></button>)}</div><div className="mt-5 hidden border-t border-white/8 pt-5 xl:block"><Link href="/content-library/packs" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-zinc-400 hover:bg-violet-400/[.06] hover:text-violet-300"><PackageOpen className="size-4" />Administrar Packs</Link><p className="mt-4 px-3 text-[10px] leading-4 text-zinc-700">Categoría = tipo de contenido<br />Collection = sesión<br />Pack = producto comercial</p></div></aside>
      <section className="min-w-0"><header className="border-b border-white/8 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row"><label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 transition focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-400/10"><Search className="size-4 text-zinc-600" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por nombre, categoría, tag, Collection o Pack…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-700" />{query ? <button type="button" onClick={() => setQuery("")} className="cursor-pointer text-zinc-600 hover:text-white"><X className="size-4" /></button> : null}</label><div className="relative"><button type="button" onClick={() => setAdding((value) => !value)} className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400"><Plus className="size-4" />Agregar contenido</button>{adding ? <div className="absolute right-0 top-13 z-40 w-72 rounded-2xl border border-white/10 bg-[#20222b] p-2 shadow-2xl shadow-black/60"><AddChoice icon={<Upload />} title="Subir desde Mac" detail="Una o varias fotos y videos" onClick={() => { setAdding(false); inputRef.current?.click(); }} /><AddChoice icon={<FolderOpen />} title="Agregar desde Fanvue" detail="Reutiliza la bóveda existente" onClick={() => { setAdding(false); setVaultOpen(true); }} /></div> : null}</div></div><input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" className="hidden" onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; void uploadFiles(files); }} /><div className="mt-3 flex gap-2 overflow-x-auto"><FilterSelect label="Categoría" value={category} options={data?.organizers.categories ?? []} onChange={setCategory} /><FilterSelect label="Collection" value={collection} options={data?.organizers.collections ?? []} onChange={setCollection} /><FilterSelect label="Tag" value={tag} options={data?.organizers.tags ?? []} onChange={setTag} /><FilterSelect label="Pack" value={pack} options={data?.organizers.packs ?? []} onChange={setPack} /><button type="button" onClick={() => setOrganizationOpen(true)} className="shrink-0 cursor-pointer rounded-xl border border-violet-400/15 px-3 py-2 text-xs text-violet-300 hover:bg-violet-400/10">+ Organización</button>{filtersActive ? <button type="button" onClick={clearFilters} className="shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs text-violet-300 hover:bg-violet-400/10">Limpiar filtros</button> : null}</div></header>
        {data?.items.length ? <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-black/[.08] px-4 py-3 sm:px-5"><div><p className="text-xs font-medium text-zinc-300">Selección masiva</p><p className="mt-0.5 text-[10px] text-zinc-600">Selecciona la página o todos los resultados del filtro y aplica una acción.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelected((current) => new Set([...current, ...data.items.map((asset) => asset.id)]))} className="cursor-pointer rounded-lg border border-violet-400/20 bg-violet-400/[.06] px-3 py-2 text-xs text-violet-300 hover:bg-violet-400/10"><Check className="mr-1.5 inline size-3.5" />Página actual ({data.items.length})</button>{data.pagination.total > data.items.length ? <button type="button" disabled={selectingAll} onClick={() => void selectAllResults()} className="cursor-pointer rounded-lg border border-violet-400/20 bg-violet-400/[.06] px-3 py-2 text-xs text-violet-300 hover:bg-violet-400/10 disabled:cursor-wait disabled:opacity-50">{selectingAll ? <LoaderCircle className="mr-1.5 inline size-3.5 animate-spin" /> : <Check className="mr-1.5 inline size-3.5" />}Todos los resultados ({data.pagination.total})</button> : null}{selectedIds.length ? <><button type="button" onClick={() => setPackSelectionOpen(true)} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"><PackageOpen className="mr-1.5 inline size-3.5" />Agregar a Pack</button><button type="button" onClick={() => { if (window.confirm(`Vas a eliminar ${selectedIds.length} elementos de Content Library. Los originales de Fanvue permanecerán intactos. ¿Deseas continuar?`)) void mutate(selectedIds, "delete"); }} className="cursor-pointer rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-400/[.06]"><Trash2 className="mr-1.5 inline size-3.5" />Eliminar {selectedIds.length}</button><button type="button" onClick={() => setSelected(new Set())} className="cursor-pointer rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-white">Limpiar</button></> : null}</div></div> : null}
        <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles([...event.dataTransfer.files]); }} className={`relative min-h-[520px] p-4 sm:p-5 ${dragging ? "ring-2 ring-inset ring-violet-400" : ""}`}>{dragging ? <div className="absolute inset-4 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-violet-400 bg-[#15171d]/95"><div className="text-center"><Upload className="mx-auto size-9 text-violet-300" /><p className="mt-3 text-sm font-medium">Suelta aquí tus archivos</p></div></div> : null}{loading ? <Loading /> : data?.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{data.items.map((asset) => <AssetTile key={asset.id} asset={asset} selected={selected.has(asset.id)} onSelect={() => toggleSelection(asset.id)} onOpen={() => setPreviewId(asset.id)} onFavorite={() => void mutate([asset.id], { isFavorite: !asset.isFavorite })} />)}</div> : <Empty view={view} onReset={clearFilters} />}</div>
        {data && data.pagination.pages > 1 ? <footer className="flex items-center justify-between border-t border-white/8 px-5 py-4"><p className="text-xs text-zinc-600">{data.pagination.total} archivos · Página {data.pagination.page} de {data.pagination.pages}</p><div className="flex gap-2"><PageButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></PageButton><PageButton disabled={page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></PageButton></div></footer> : null}
      </section>
    </div>
    {selectedIds.length ? <SelectionBar count={selectedIds.length} downloadProgress={downloadProgress} onClear={() => setSelected(new Set())} onPack={() => setPackSelectionOpen(true)} onOrganize={() => setOrganizeSelection(true)} onDownload={() => void downloadSelected()} onFavorite={() => void mutate(selectedIds, { isFavorite: true })} onArchive={() => void mutate(selectedIds, { isArchived: true })} onDelete={() => { if (window.confirm(`¿Eliminar ${selectedIds.length} elementos de la biblioteca? Los originales de Fanvue permanecerán intactos.`)) void mutate(selectedIds, "delete"); }} /> : null}
    {preview && data ? <AssetPreview key={preview.id} asset={preview} assets={data.items} organizers={data.organizers} onClose={() => setPreviewId(null)} onNavigate={setPreviewId} onMutate={(changes) => void mutate([preview.id], changes)} onDelete={() => { setPreviewId(null); void mutate([preview.id], "delete"); }} /> : null}
    {organizeSelection && data ? <OrganizeDialog count={selectedIds.length} organizers={data.organizers} onClose={() => setOrganizeSelection(false)} onSave={(changes) => void organizeSelected(changes)} /> : null}
    {packSelectionOpen && data ? <PackSelectionDialog count={selectedIds.length} packs={data.organizers.packs} onClose={() => setPackSelectionOpen(false)} onSelect={(packId) => void addSelectionToPack(packId)} /> : null}
    {organizationOpen && data ? <OrganizationDialog organizers={data.organizers} onClose={() => setOrganizationOpen(false)} onCreate={(action, name) => void createOrganizer(action, name)} /> : null}
    {vaultOpen ? <VaultMediaPicker selectedUuids={[]} remaining={100} onClose={() => setVaultOpen(false)} onAdd={(media) => { setVaultOpen(false); void importMedia(media); }} /> : null}
    {uploads.length ? <UploadQueue items={uploads} completed={completedUploads} onClose={() => uploadAbort.current ? uploadAbort.current.abort() : setUploads([])} /> : null}
  </div>;
}

function AssetTile({ asset, selected, onSelect, onOpen, onFavorite }: { asset: Asset; selected: boolean; onSelect: () => void; onOpen: () => void; onFavorite: () => void }) {
  const source = asset.thumbnailUrl ?? asset.url;
  return <article className={`group overflow-hidden rounded-2xl border bg-black/15 transition ${selected ? "border-violet-400 ring-2 ring-violet-400/15" : "border-white/8 hover:-translate-y-0.5 hover:border-white/20"}`}><div className="relative aspect-square overflow-hidden bg-black/25"><button type="button" onClick={onOpen} className="absolute inset-0 z-[1] size-full cursor-zoom-in">{source ? asset.mediaType === "video" && !asset.thumbnailUrl ? <video src={source} muted preload="metadata" className="size-full object-cover" /> : <img src={source} alt={asset.name} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <span className="grid size-full place-items-center text-zinc-700">{asset.mediaType === "video" ? <Film /> : <ImageIcon />}</span>}</button><button type="button" aria-label={selected ? "Quitar selección" : "Seleccionar"} onClick={onSelect} className={`absolute left-2 top-2 z-10 grid size-7 cursor-pointer place-items-center rounded-lg border backdrop-blur ${selected ? "border-violet-300 bg-violet-500 text-white" : "border-white/20 bg-black/55 text-transparent hover:text-white"}`}><Check className="size-4" /></button><div className="pointer-events-none absolute bottom-2 left-2 z-10 flex gap-1">{asset.mediaType === "video" ? <Badge><Film className="size-3" />Video</Badge> : null}{asset.packs?.length ? <Badge><PackageOpen className="size-3" />{asset.packs.length}</Badge> : null}</div></div><div className="flex items-center gap-2 p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-zinc-200">{asset.name}</p><p className="mt-1 truncate text-[10px] text-zinc-600">{asset.category?.name ?? (asset.packs?.length ? `En ${asset.packs.length} Pack${asset.packs.length > 1 ? "s" : ""}` : "Sin organizar")}</p></div><button type="button" onClick={onFavorite} className={`cursor-pointer rounded-lg p-2 ${asset.isFavorite ? "text-pink-400" : "text-zinc-600 hover:text-pink-300"}`}><Heart className={`size-4 ${asset.isFavorite ? "fill-current" : ""}`} /></button><button type="button" onClick={onOpen} className="cursor-pointer rounded-lg p-2 text-zinc-600 hover:text-white"><MoreHorizontal className="size-4" /></button></div></article>;
}

function AssetPreview({ asset, assets, organizers, onClose, onNavigate, onMutate, onDelete }: { asset: Asset; assets: Asset[]; organizers: LibraryData["organizers"]; onClose: () => void; onNavigate: (id: string) => void; onMutate: (changes: Record<string, unknown>) => void; onDelete: () => void }) {
  const [categoryId, setCategoryId] = useState(asset.category?.id ?? "");
  const [collectionIds, setCollectionIds] = useState(asset.collections?.map((item) => item.id) ?? []);
  const [tagIds, setTagIds] = useState(asset.tags?.map((item) => item.id) ?? []);
  const index = assets.findIndex((item) => item.id === asset.id);
  const navigate = (delta: number) => { const next = assets[index + delta]; if (next) onNavigate(next.id); };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onNavigate(assets[index - 1].id);
      if (event.key === "ArrowRight" && index < assets.length - 1) onNavigate(assets[index + 1].id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [assets, index, onClose, onNavigate]);
  const toggle = (values: string[], id: string, setter: (items: string[]) => void) => setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  return <div className="fixed inset-0 z-[150] flex bg-black/90 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Vista previa de ${asset.name}`}><button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 z-30 grid size-10 cursor-pointer place-items-center rounded-full bg-black/60 text-white hover:bg-black"><X className="size-5" /></button><div className="grid size-full min-h-0 lg:grid-cols-[minmax(0,1fr)_390px]"><section className="relative grid min-h-[48vh] place-items-center overflow-hidden p-4 lg:min-h-0 lg:p-8">{asset.url ? asset.mediaType === "video" ? <video key={asset.id} src={asset.url} poster={asset.thumbnailUrl} controls autoPlay className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" /> : <img src={asset.url} alt={asset.name} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" /> : <div className="text-center text-zinc-600"><ImageIcon className="mx-auto size-10" /><p className="mt-3 text-xs">Vista previa no disponible</p></div>}<button type="button" disabled={index <= 0} onClick={() => navigate(-1)} className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/55 text-white disabled:hidden"><ChevronLeft /></button><button type="button" disabled={index >= assets.length - 1} onClick={() => navigate(1)} className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/55 text-white disabled:hidden"><ChevronRight /></button><span className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1.5 text-[10px] text-zinc-400">{index + 1} de {assets.length}</span></section><aside className="min-h-0 overflow-y-auto border-t border-white/10 bg-[#15171d] p-5 lg:border-l lg:border-t-0 lg:p-6"><p className="text-[10px] font-medium uppercase tracking-[.16em] text-violet-300">Detalle del contenido</p><h2 className="mt-2 break-words text-lg font-semibold text-white">{asset.name}</h2><dl className="mt-5 grid grid-cols-2 gap-2"><Info label="Tipo" value={asset.mediaType === "image" ? "Foto" : "Video"} /><Info label="Dimensiones" value={asset.width && asset.height ? `${asset.width} × ${asset.height}` : "No disponibles"} /><Info label="Duración" value={asset.durationMs ? `${Math.round(asset.durationMs / 1000)} s` : "—"} /><Info label="Agregado" value={new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(asset.createdAt))} /></dl><SectionTitle>Organización</SectionTitle><label className="text-[10px] text-zinc-600">Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#20222b] px-3 py-2.5 text-xs text-zinc-300"><option value="">Sin categoría</option>{organizers.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Choice title="Collections" options={organizers.collections} selected={collectionIds} onToggle={(id) => toggle(collectionIds, id, setCollectionIds)} /><Choice title="Tags" options={organizers.tags} selected={tagIds} onToggle={(id) => toggle(tagIds, id, setTagIds)} /><button type="button" onClick={() => onMutate({ categoryId: categoryId || null, collectionIds, tagIds })} className="mt-4 w-full cursor-pointer rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-400">Guardar organización</button><SectionTitle>Dónde se utiliza</SectionTitle><Usage asset={asset} /><div className="mt-6 grid grid-cols-2 gap-2"><a href={`/api/content-library/download?id=${encodeURIComponent(asset.id)}`} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-xs text-zinc-300 hover:bg-white/5"><Download className="size-4" />Descargar</a><button type="button" onClick={() => onMutate({ isFavorite: !asset.isFavorite })} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-xs text-zinc-300 hover:bg-white/5"><Heart className={`size-4 ${asset.isFavorite ? "fill-current text-pink-400" : ""}`} />Favorito</button><button type="button" onClick={() => onMutate({ isArchived: !asset.isArchived })} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-xs text-zinc-300 hover:bg-white/5"><Archive className="size-4" />{asset.isArchived ? "Restaurar" : "Archivar"}</button><button type="button" onClick={() => { if (window.confirm("¿Eliminar este elemento de Content Library? El original de Fanvue permanecerá intacto.")) onDelete(); }} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-400/15 px-3 py-3 text-xs text-red-300"><Trash2 className="size-4" />Eliminar</button></div></aside></div></div>;
}

function Usage({ asset }: { asset: Asset }) { const empty = !asset.packs?.length && !asset.collections?.length && !asset.templates?.length; if (empty) return <p className="rounded-xl border border-dashed border-white/8 p-4 text-center text-xs text-zinc-600">Todavía no se utiliza en Packs, Collections o plantillas.</p>; return <div className="space-y-2">{asset.packs?.map((item) => <Link key={`p-${item.id}`} href={`/content-library/packs?pack=${item.id}`} className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2.5 text-xs text-zinc-300 hover:border-violet-400/30"><PackageOpen className="size-3.5 text-violet-300" /><span className="truncate">{item.name}</span></Link>)}{asset.collections?.map((item) => <Link key={`c-${item.id}`} href={`/content-library?collection=${item.id}`} className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2.5 text-xs text-zinc-300"><FolderOpen className="size-3.5 text-sky-300" /><span className="truncate">{item.name}</span></Link>)}{asset.templates?.map((item) => <Link key={`t-${item.id}`} href={`/templates#template-${item.id}`} className="flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2.5 text-xs text-zinc-300"><Grid2X2 className="size-3.5 text-fuchsia-300" /><span className="truncate">{item.name}</span></Link>)}</div>; }

function OrganizeDialog({ count, organizers, onClose, onSave }: { count: number; organizers: LibraryData["organizers"]; onClose: () => void; onSave: (changes: Record<string, unknown>) => void }) {
  const [categoryId, setCategoryId] = useState("unchanged");
  const [collectionMode, setCollectionMode] = useState<"add" | "replace" | "remove">("add");
  const [tagMode, setTagMode] = useState<"add" | "replace" | "remove">("add");
  const [collections, setCollections] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const toggle = (values: string[], id: string, setter: (items: string[]) => void) => setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  const hasChanges = categoryId !== "unchanged" || collections.length > 0 || tags.length > 0 || (collectionMode === "replace" && !collections.length) || (tagMode === "replace" && !tags.length);

  return <div className="fixed inset-0 z-[160] grid place-items-center bg-black/80 p-3 backdrop-blur" role="dialog" aria-modal="true" aria-label="Organizar selección">
    <div className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#181a21] p-5 shadow-2xl">
      <div className="flex justify-between"><div><h2 className="font-semibold text-white">Organizar selección</h2><p className="mt-1 text-xs text-zinc-500">Los cambios se aplicarán a {count} elementos en una sola operación.</p></div><button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/5"><X className="size-4" /></button></div>
      <label className="mt-5 block text-xs text-zinc-500">Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-[#20222b] p-3 text-zinc-300"><option value="unchanged">No cambiar categoría</option><option value="clear">Quitar categoría</option>{organizers.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <BulkOrganizer title="Collections" mode={collectionMode} onMode={setCollectionMode} options={organizers.collections} selected={collections} onToggle={(id) => toggle(collections, id, setCollections)} />
      <BulkOrganizer title="Tags" mode={tagMode} onMode={setTagMode} options={organizers.tags} selected={tags} onToggle={(id) => toggle(tags, id, setTags)} />
      <div className="mt-5 rounded-xl border border-violet-400/10 bg-violet-400/[.04] p-3 text-[10px] leading-4 text-zinc-500"><b className="text-violet-300">Agregar</b> conserva lo existente. <b className="text-violet-300">Reemplazar</b> deja únicamente tu selección. <b className="text-violet-300">Quitar</b> elimina solo lo seleccionado.</div>
      <button type="button" disabled={!hasChanges} onClick={() => onSave({ ...(categoryId !== "unchanged" ? { categoryId: categoryId === "clear" ? null : categoryId } : {}), ...(collections.length || collectionMode === "replace" ? { collections: { mode: collectionMode, ids: collections } } : {}), ...(tags.length || tagMode === "replace" ? { tags: { mode: tagMode, ids: tags } } : {}) })} className="mt-5 w-full cursor-pointer rounded-xl bg-violet-500 p-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">Aplicar a {count} elementos</button>
    </div>
  </div>;
}

function BulkOrganizer({ title, mode, onMode, options, selected, onToggle }: { title: string; mode: "add" | "replace" | "remove"; onMode: (mode: "add" | "replace" | "remove") => void; options: Organizer[]; selected: string[]; onToggle: (id: string) => void }) {
  return <div className="mt-5 rounded-2xl border border-white/8 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-zinc-300">{title}</p><select value={mode} onChange={(event) => onMode(event.target.value as "add" | "replace" | "remove")} className="cursor-pointer rounded-lg border border-white/10 bg-[#20222b] px-2.5 py-2 text-[10px] text-zinc-400"><option value="add">Agregar</option><option value="replace">Reemplazar</option><option value="remove">Quitar</option></select></div><div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">{options.length ? options.map((item) => <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={`cursor-pointer rounded-full border px-2.5 py-1.5 text-[10px] ${selected.includes(item.id) ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/8 text-zinc-500 hover:border-white/20"}`}>{item.name}</button>) : <span className="text-[10px] text-zinc-700">No hay opciones.</span>}</div>{mode === "replace" && !selected.length ? <p className="mt-2 text-[10px] text-amber-300">Esto quitará todos los {title.toLowerCase()} de la selección.</p> : null}</div>;
}

function SelectionBar({ count, downloadProgress, onClear, onPack, onOrganize, onDownload, onFavorite, onArchive, onDelete }: { count: number; downloadProgress: number | null | undefined; onClear: () => void; onPack: () => void; onOrganize: () => void; onDownload: () => void; onFavorite: () => void; onArchive: () => void; onDelete: () => void }) { return <div className="fixed bottom-5 left-1/2 z-[120] flex w-[min(860px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-violet-400/25 bg-[#20222b]/95 p-2.5 shadow-2xl shadow-black/70 backdrop-blur"><div className="flex min-w-28 flex-1 items-center gap-2 px-2 text-xs font-medium text-white"><span className="grid size-7 place-items-center rounded-lg bg-violet-500">{count}</span>seleccionados</div><Action icon={<PackageOpen />} label="Agregar a Pack" onClick={onPack} /><Action icon={<ListFilter />} label="Organizar" onClick={onOrganize} /><Action icon={downloadProgress !== undefined ? <LoaderCircle className="animate-spin" /> : <Download />} label={downloadProgress === null ? "Preparando…" : downloadProgress !== undefined ? `${downloadProgress}%` : "Descargar"} onClick={onDownload} /><Action icon={<Heart />} label="Favorito" onClick={onFavorite} /><Action icon={<Archive />} label="Archivar" onClick={onArchive} /><Action icon={<Trash2 />} label="Eliminar" onClick={onDelete} danger /><button type="button" onClick={onClear} className="grid size-9 cursor-pointer place-items-center rounded-lg text-zinc-500 hover:bg-white/5"><X className="size-4" /></button></div>; }

function PackSelectionDialog({ count, packs, onClose, onSelect }: { count: number; packs: Organizer[]; onClose: () => void; onSelect: (packId: string) => void }) { const [query, setQuery] = useState(""); const visible = packs.filter((pack) => pack.name.toLocaleLowerCase("es-MX").includes(query.trim().toLocaleLowerCase("es-MX"))); return <div className="fixed inset-0 z-[170] grid place-items-center bg-black/80 p-3 backdrop-blur"><div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#181a21] shadow-2xl"><header className="flex items-start justify-between border-b border-white/8 p-5"><div><h2 className="font-semibold text-white">Agregar a Pack</h2><p className="mt-1 text-xs text-zinc-500">Agrega {count} {count === 1 ? "archivo" : "archivos"} sin duplicarlos.</p></div><button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-white/5"><X className="size-4" /></button></header><div className="p-4"><label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="size-4 text-zinc-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar Pack…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{visible.length ? visible.map((pack) => <button key={pack.id} type="button" onClick={() => onSelect(pack.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/8 p-3 text-left hover:border-violet-400/30 hover:bg-violet-400/[.04]"><span className="grid size-9 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><PackageOpen className="size-4" /></span><span className="min-w-0 flex-1"><b className="block truncate text-xs font-medium text-zinc-200">{pack.name}</b><small className="text-[10px] text-zinc-600">{pack.count} assets actualmente</small></span><Plus className="size-4 text-zinc-600" /></button>) : <div className="rounded-xl border border-dashed border-white/8 p-8 text-center text-xs text-zinc-600">{packs.length ? "No hay Packs que coincidan." : "Todavía no hay Packs. Crea uno desde Administrar Packs."}</div>}</div>{!packs.length ? <Link href="/content-library/packs" className="mt-3 block rounded-xl bg-violet-500 px-4 py-3 text-center text-xs font-semibold text-white">Crear mi primer Pack</Link> : null}</div></div></div>; }

function OrganizationDialog({ organizers, onClose, onCreate }: { organizers: LibraryData["organizers"]; onClose: () => void; onCreate: (action: "createCategory" | "createCollection" | "createTag", name: string) => void }) { const [kind, setKind] = useState<"createCategory" | "createCollection" | "createTag">("createCategory"); const [name, setName] = useState(""); const list = kind === "createCategory" ? organizers.categories : kind === "createCollection" ? organizers.collections : organizers.tags; return <div className="fixed inset-0 z-[160] grid place-items-center bg-black/80 p-3 backdrop-blur"><div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#181a21] p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-white">Administrar organización</h2><p className="mt-1 text-xs text-zinc-500">Crea estructuras reutilizables para clasificar el contenido.</p></div><button type="button" onClick={onClose}><X /></button></div><div className="mt-5 grid grid-cols-3 gap-2">{([['createCategory', 'Categorías'], ['createCollection', 'Collections'], ['createTag', 'Tags']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-xl px-3 py-2 text-xs ${kind === value ? "bg-violet-500 text-white" : "bg-white/[.04] text-zinc-500"}`}>{label}</button>)}</div><div className="mt-4 flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre nuevo…" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-violet-400/40" /><button type="button" disabled={name.trim().length < 2} onClick={() => { onCreate(kind, name.trim()); setName(""); }} className="cursor-pointer rounded-xl bg-violet-500 px-4 text-xs font-semibold disabled:opacity-35">Crear</button></div><div className="mt-5 max-h-52 space-y-2 overflow-y-auto">{list.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/8 px-3 py-2.5"><span className="text-xs text-zinc-300">{item.name}</span><span className="text-[10px] text-zinc-600">{item.count} assets</span></div>)}</div></div></div>; }

function UploadQueue({ items, completed, onClose }: { items: UploadItem[]; completed: number; onClose: () => void }) { return <div className="fixed bottom-5 right-5 z-[130] w-[min(390px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#20222b] p-4 shadow-2xl"><div className="flex justify-between"><div><p className="text-sm font-medium">Subiendo contenido</p><p className="text-[10px] text-zinc-500">{completed} de {items.length}</p></div><button type="button" onClick={onClose}><X className="size-4" /></button></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-violet-500 transition-all" style={{ width: `${items.length ? completed / items.length * 100 : 0}%` }} /></div><div className="mt-3 max-h-32 space-y-2 overflow-y-auto">{items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center gap-2 text-[10px]"><span className="grid size-4 place-items-center">{item.status === "uploading" ? <LoaderCircle className="size-3 animate-spin" /> : item.status === "done" ? <Check className="size-3 text-emerald-300" /> : item.status === "error" ? <X className="size-3 text-red-300" /> : "·"}</span><span className="truncate text-zinc-500">{item.name}</span></div>)}</div></div>; }

function Choice({ title, options, selected, onToggle }: { title: string; options: Organizer[]; selected: string[]; onToggle: (id: string) => void }) { return <div className="mt-4"><p className="text-[10px] text-zinc-600">{title}</p><div className="mt-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto">{options.length ? options.map((item) => <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={`cursor-pointer rounded-full border px-2.5 py-1.5 text-[10px] ${selected.includes(item.id) ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/8 text-zinc-500"}`}>{item.name}</button>) : <span className="text-[10px] text-zinc-700">No hay opciones.</span>}</div></div>; }
function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Organizer[]; onChange: (value: string) => void }) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 shrink-0 cursor-pointer rounded-xl border border-white/8 bg-[#20222b] px-3 text-xs text-zinc-400"><option value="">{label}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count})</option>)}</select>; }
function AddChoice({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5"><span className="grid size-9 place-items-center rounded-xl bg-violet-400/10 text-violet-300">{icon}</span><span><b className="block text-xs font-medium text-zinc-200">{title}</b><small className="text-[10px] text-zinc-600">{detail}</small></span></button>; }
function Action({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) { return <button type="button" onClick={onClick} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] hover:bg-white/5 ${danger ? "text-red-300" : "text-zinc-400"}`}>{icon}<span className="hidden sm:inline">{label}</span></button>; }
function Badge({ children }: { children: ReactNode }) { return <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[9px] text-white backdrop-blur">{children}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/8 bg-black/15 p-3"><dt className="text-[9px] uppercase tracking-wide text-zinc-700">{label}</dt><dd className="mt-1 text-[11px] text-zinc-300">{value}</dd></div>; }
function SectionTitle({ children }: { children: ReactNode }) { return <p className="mb-3 mt-6 border-t border-white/8 pt-5 text-[10px] font-medium uppercase tracking-[.14em] text-zinc-600">{children}</p>; }
function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" disabled={disabled} onClick={onClick} className="grid size-9 cursor-pointer place-items-center rounded-lg border border-white/10 text-zinc-400 disabled:cursor-not-allowed disabled:opacity-30">{children}</button>; }
function Loading() { return <div className="grid min-h-[480px] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-violet-400" /><p className="mt-3 text-xs text-zinc-600">Cargando biblioteca…</p></div></div>; }
function Empty({ view, onReset }: { view: View; onReset: () => void }) { return <div className="grid min-h-[480px] place-items-center text-center"><div><ImageIcon className="mx-auto size-10 text-zinc-800" /><p className="mt-3 text-sm font-medium text-zinc-300">No hay contenido en esta vista</p><p className="mt-1 text-xs text-zinc-600">{view === "unused" ? "Todo tu contenido ya pertenece a algún Pack." : "Prueba con otros filtros o agrega contenido nuevo."}</p><button type="button" onClick={onReset} className="mt-4 cursor-pointer text-xs text-violet-300">Limpiar filtros</button></div></div>; }
