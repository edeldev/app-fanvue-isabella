"use client";

import { FileText, LoaderCircle, MessageSquare, Search, Workflow, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SearchResult = { id: string; type: "fan" | "template" | "workflow"; title: string; subtitle: string; href: string; avatarUrl?: string | null };

export function GlobalSearch() {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const body = await response.json();
        if (response.ok) { setResults(body.results ?? []); setActive(0); }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 220);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  const select = (result: SearchResult) => { setOpen(false); setQuery(""); router.push(result.href); };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setOpen(false); input.current?.blur(); }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
    if (event.key === "Enter" && results[active]) { event.preventDefault(); select(results[active]); }
  };

  return <div ref={container} className="relative min-w-0 flex-1 sm:max-w-xl">
    <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-transparent px-3 text-zinc-500 transition focus-within:border-white/10 focus-within:bg-black/20 focus-within:ring-2 focus-within:ring-violet-400/10">
      <Search className="size-4 shrink-0" /><span className="sr-only">Buscar en toda la aplicación</span>
      <input ref={input} value={query} onFocus={() => setOpen(true)} onChange={(event) => { const value = event.target.value; setQuery(value); setOpen(true); if (value.trim().length < 2) { setResults([]); setLoading(false); } }} onKeyDown={onKeyDown} placeholder="Buscar fans, plantillas y workflows…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : query ? <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Limpiar búsqueda" className="rounded-md p-1 hover:bg-white/5 hover:text-white"><X className="size-3.5" /></button> : <kbd className="hidden rounded-md border border-white/8 bg-white/[.035] px-1.5 py-0.5 text-[10px] text-zinc-600 md:block">⌘ K</kbd>}
    </label>
    {open && query.trim().length >= 2 ? <div className="absolute left-0 right-0 top-12 z-50 max-h-[min(28rem,70vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#181a21] p-2 shadow-2xl shadow-black/60">
      {results.length ? <ul role="listbox" aria-label="Resultados de búsqueda">{results.map((result, index) => { const Icon = result.type === "fan" ? MessageSquare : result.type === "template" ? FileText : Workflow; return <li key={result.id}><button type="button" role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => select(result)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${index === active ? "bg-violet-500/12" : "hover:bg-white/5"}`}>{result.avatarUrl ? <span className="size-9 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(result.avatarUrl).slice(1, -1)})` }} /> : <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 text-violet-300"><Icon className="size-4" /></span>}<span className="min-w-0"><span className="block truncate text-sm font-medium text-zinc-200">{result.title}</span><span className="mt-0.5 block truncate text-[11px] text-zinc-600">{result.subtitle}</span></span></button></li>; })}</ul> : loading ? null : <div className="px-4 py-8 text-center"><Search className="mx-auto mb-2 size-5 text-zinc-700" /><p className="text-xs text-zinc-500">No encontramos resultados para “{query.trim()}”.</p></div>}
    </div> : null}
  </div>;
}
