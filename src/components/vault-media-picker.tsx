/* eslint-disable @next/next/no-img-element -- Fanvue returns temporary signed thumbnail URLs. */
"use client";

import { Check, Film, ImageIcon, LoaderCircle, Play, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AttachedMedia } from "@/components/media-fields";

type VaultMedia = AttachedMedia & { createdAt?: string | null };

export function VaultMediaPicker({ selectedUuids, remaining, onClose, onAdd }: { selectedUuids: string[]; remaining: number; onClose: () => void; onAdd: (media: AttachedMedia[]) => void }) {
  const [items, setItems] = useState<VaultMedia[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | "image" | "video">("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextCursor = "", append = false, signal?: AbortSignal) {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (type) params.set("type", type);
    if (nextCursor) params.set("cursor", nextCursor);
    try {
      const response = await fetch(`/api/media/vault?${params}`, { signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se pudo abrir la bóveda.");
      setItems((current) => append ? [...current, ...body.media] : body.media);
      setCursor(body.nextCursor ?? null);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "No se pudo abrir la bóveda.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void load("", false, controller.signal), 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]);

  const available = items.filter((item) => !selectedUuids.includes(item.uuid));
  const toggle = (uuid: string) => setSelected((current) => current.includes(uuid) ? current.filter((value) => value !== uuid) : current.length < remaining ? [...current, uuid] : current);

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Bóveda de Fanvue">
    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15171d] shadow-2xl shadow-black/70">
      <header className="flex items-start justify-between gap-4 border-b border-white/8 p-5"><div><h2 className="text-lg font-semibold text-white">Bóveda de Fanvue</h2><p className="mt-1 text-xs text-zinc-500">Selecciona hasta {remaining} archivos existentes. No se volverán a subir.</p></div><button type="button" onClick={onClose} aria-label="Cerrar bóveda" className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-5" /></button></header>
      <div className="flex flex-col gap-3 border-b border-white/8 p-4 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-violet-400/40"><Search className="size-4 text-zinc-600" /><input value={query} onChange={(event) => { setQuery(event.target.value); setItems([]); setCursor(null); setLoading(true); }} placeholder="Buscar por nombre…" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /></label><div className="flex rounded-xl border border-white/8 bg-black/20 p-1">{[["", "Todo"], ["image", "Fotos"], ["video", "Videos"]].map(([value, label]) => <button key={value} type="button" onClick={() => { if (type === value) return; setType(value as typeof type); setItems([]); setCursor(null); setLoading(true); }} className={`rounded-lg px-3 py-2 text-xs ${type === value ? "bg-violet-500 text-white" : "text-zinc-500 hover:text-white"}`}>{label}</button>)}</div></div>
      <div className="min-h-64 flex-1 overflow-y-auto p-4">{error ? <div className="grid min-h-64 place-items-center text-center"><div><p className="text-sm text-red-300">{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">Reintentar</button></div></div> : loading && !cursor ? <div className="grid min-h-64 place-items-center text-center"><div><LoaderCircle className="mx-auto size-7 animate-spin text-violet-400" /><p className="mt-3 text-xs text-zinc-500">Cargando {type === "image" ? "fotos" : type === "video" ? "videos" : "archivos"}…</p></div></div> : available.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{available.map((item) => { const chosen = selected.includes(item.uuid); return <button key={item.uuid} type="button" onClick={() => toggle(item.uuid)} className={`group overflow-hidden rounded-xl border text-left transition ${chosen ? "border-violet-400 ring-2 ring-violet-400/20" : "border-white/8 hover:border-white/20"}`}><div className="relative aspect-square bg-black/30"><VaultPreview item={item} />{item.mediaType === "video" ? <span className="pointer-events-none absolute inset-0 grid place-items-center"><span className="grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur"><Play className="ml-0.5 size-4 fill-current" /></span></span> : null}{chosen ? <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-violet-500 text-white"><Check className="size-4" /></span> : null}</div><p className="truncate px-2 py-2 text-[10px] text-zinc-400" title={item.name}>{item.name}</p></button>; })}</div> : <div className="grid min-h-64 place-items-center text-center text-sm text-zinc-500">No encontramos fotos o videos disponibles.</div>}{loading && cursor ? <div className="mt-4 flex justify-center"><LoaderCircle className="size-5 animate-spin text-violet-400" /></div> : null}{cursor && !loading ? <button type="button" onClick={() => void load(cursor, true)} className="mx-auto mt-5 block rounded-xl border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5">Cargar más</button> : null}</div>
      <footer className="flex items-center justify-between gap-3 border-t border-white/8 p-4"><p className="text-xs text-zinc-500">{selected.length} de {remaining} seleccionados</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5">Cancelar</button><button type="button" disabled={!selected.length} onClick={() => onAdd(items.filter((item) => selected.includes(item.uuid)))} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-40">Agregar seleccionados</button></div></footer>
    </div>
  </div>;
}

function VaultPreview({ item }: { item: VaultMedia }) {
  const source = item.thumbnailUrl ?? item.localUrl;
  const [state, setState] = useState<{ source?: string; status: "loading" | "loaded" | "error" }>({ source, status: source ? "loading" : "error" });
  const status = state.source === source ? state.status : source ? "loading" : "error";
  return <div className="relative size-full overflow-hidden">{status === "loading" ? <span className="absolute inset-0 grid animate-pulse place-items-center bg-gradient-to-br from-white/[.07] via-white/[.025] to-transparent text-zinc-500"><LoaderCircle className="size-5 animate-spin" /></span> : null}{status === "error" ? <span className="absolute inset-0 grid place-items-center text-zinc-700">{item.mediaType === "video" ? <Film /> : <ImageIcon />}</span> : null}{source ? item.mediaType === "video" && !item.thumbnailUrl ? <video src={source} muted preload="metadata" onLoadedData={() => setState({ source, status: "loaded" })} onError={() => setState({ source, status: "error" })} className={`size-full object-cover transition-opacity ${status === "loaded" ? "opacity-100" : "opacity-0"}`} /> : <img src={source} alt="" loading="lazy" onLoad={() => setState({ source, status: "loaded" })} onError={() => setState({ source, status: "error" })} className={`size-full object-cover transition-opacity ${status === "loaded" ? "opacity-100" : "opacity-0"}`} /> : null}</div>;
}
