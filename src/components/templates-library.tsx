"use client";

import { ChevronLeft, ChevronRight, FileText, ImageIcon, LockKeyhole, Pencil, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AttachedMedia } from "@/components/media-fields";
import { TemplateForm } from "@/components/template-form";
import { matchesTemplateKind, type TemplateKindFilter } from "@/domain/templates/filters";

export type TemplateLibraryItem = { id: string; name: string; text: string; type: string; category: string; status: string; updatedAt: string; media: AttachedMedia[]; priceMinor: number | null; previewUuid: string | null };
const PAGE_SIZE = 8;
const categories: Record<string, string> = { WELCOME: "Bienvenida", FOLLOW_UP: "Seguimiento", RENEWAL: "Renovación", SALES: "Venta", VIP: "VIP", REACTIVATION: "Reactivación", GENERAL: "General" };
const kindFilters: ReadonlyArray<[TemplateKindFilter, string]> = [["ALL", "Todas"], ["TEXT", "Solo texto"], ["MEDIA", "Con multimedia"], ["IMAGE", "Fotos"], ["VIDEO", "Videos"], ["MEDIA_ONLY", "Solo archivos"], ["PPV", "PPV"]];

function mediaComposition(template: TemplateLibraryItem) {
  const images = template.media.filter((item) => item.mediaType === "image").length;
  const videos = template.media.filter((item) => item.mediaType === "video").length;
  const parts = [images ? `${images} ${images === 1 ? "foto" : "fotos"}` : "", videos ? `${videos} ${videos === 1 ? "video" : "videos"}` : ""].filter(Boolean);
  if (!parts.length) return "Solo texto";
  return `${template.text.trim() ? "Texto + " : "Solo "}${parts.join(" y ")}`;
}

export function TemplatesLibrary({ templates }: { templates: TemplateLibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [kind, setKind] = useState<TemplateKindFilter>("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TemplateLibraryItem | null>(null);
  useEffect(() => {
    if (!editing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setEditing(null); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [editing]);

  const filtered = useMemo(() => templates.filter((template) => {
    const term = query.trim().toLocaleLowerCase("es-MX");
    const matchesQuery = !term || template.name.toLocaleLowerCase("es-MX").includes(term) || template.text.toLocaleLowerCase("es-MX").includes(term);
    const matchesCategory = category === "ALL" || template.category === category;
    const matchesKind = matchesTemplateKind(template, kind);
    return matchesQuery && matchesCategory && matchesKind;
  }), [templates, query, category, kind]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const resetPage = () => setPage(1);

  return <section className="min-w-0">
    <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><div className="flex flex-col gap-3 lg:flex-row"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-400/10"><Search className="size-4 text-zinc-600" /><span className="sr-only">Buscar plantillas</span><input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Buscar por nombre o contenido…" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />{query ? <button type="button" onClick={() => { setQuery(""); resetPage(); }} aria-label="Limpiar búsqueda" className="rounded-md p-1 text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-4" /></button> : null}</label><select value={category} onChange={(event) => { setCategory(event.target.value); resetPage(); }} aria-label="Filtrar por categoría" className="h-11 rounded-xl border border-white/10 bg-[#181a21] px-3 text-xs text-zinc-300 outline-none"><option value="ALL">Todas las categorías</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-black/15 p-1">{kindFilters.map(([value, label]) => <button key={value} type="button" onClick={() => { setKind(value); resetPage(); }} className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${kind === value ? "bg-violet-500 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}>{label}</button>)}<span className="ml-auto shrink-0 self-center px-2 text-[10px] text-zinc-600">{filtered.length} resultados</span></div>
      {kind === "MEDIA" ? <p className="mt-2 text-[10px] text-zinc-600">Incluye plantillas gratuitas con fotos o videos, tengan texto o sean solo archivos. Las plantillas de pago aparecen únicamente en PPV.</p> : null}
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-2">{visible.map((template) => { const ppv = Boolean(template.priceMinor); const media = template.media.length; return <article key={template.id} id={`template-${template.id}`} className="scroll-mt-20 overflow-hidden rounded-2xl border border-white/8 bg-[#15171d] transition target:border-violet-400/50 target:ring-2 target:ring-violet-400/10 hover:border-white/14 hover:bg-[#171920]"><div className="flex items-start gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${ppv ? "bg-amber-400/10 text-amber-300" : media ? "bg-sky-400/10 text-sky-300" : "bg-violet-400/10 text-violet-300"}`}>{ppv ? <LockKeyhole className="size-4" /> : media ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-zinc-100">{template.name}</h3><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-zinc-500">{categories[template.category] ?? template.category}</span>{ppv ? <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-medium text-amber-300">PPV ${(template.priceMinor! / 100).toFixed(2)}</span> : null}</div><p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500">{template.text || "Plantilla con contenido multimedia"}</p><div className="mt-3 flex flex-wrap gap-3 text-[10px] text-zinc-700"><span>{mediaComposition(template)}</span><span>Actualizada {new Date(template.updatedAt).toLocaleDateString("es-MX")}</span></div></div><button type="button" onClick={() => setEditing(template)} aria-label={`Editar ${template.name}`} className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/8 text-zinc-500 transition hover:border-violet-400/20 hover:bg-violet-400/8 hover:text-violet-300"><Pencil className="size-4" /></button></div></article>; })}</div>
    {!visible.length ? <div className="mt-4 grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] text-center"><div><FileText className="mx-auto mb-3 size-8 text-zinc-700" /><p className="text-sm font-medium text-zinc-300">No encontramos plantillas</p><p className="mt-1 text-xs text-zinc-600">Cambia los filtros o crea una nueva plantilla.</p></div></div> : null}
    {filtered.length > PAGE_SIZE ? <nav aria-label="Paginación de plantillas" className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-4 py-3"><p className="text-xs text-zinc-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}</p><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)} aria-label="Página anterior" className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-25"><ChevronLeft className="size-4" /></button><span className="min-w-14 text-center text-xs text-zinc-500">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente" className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-25"><ChevronRight className="size-4" /></button></div></nav> : null}

    {editing ? <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-template-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15171d] shadow-2xl shadow-black/70"><header className="flex items-start justify-between gap-4 border-b border-white/8 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><Pencil className="size-4" /></span><div><h2 id="edit-template-title" className="font-semibold text-white">Editar plantilla</h2><p className="mt-1 text-[11px] text-zinc-500">{editing.name}</p></div></div><button type="button" onClick={() => setEditing(null)} aria-label="Cerrar edición" className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-5" /></button></header><div className="flex-1 overflow-y-auto p-4 sm:p-6"><TemplateForm template={editing} /><form action="/api/templates" method="post" className="mt-5 border-t border-white/8 pt-4"><input type="hidden" name="action" value="delete" /><input type="hidden" name="id" value={editing.id} /><button className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-red-400 hover:bg-red-400/8"><Trash2 className="size-3.5" />Eliminar plantilla</button></form></div></div></div> : null}
  </section>;
}
