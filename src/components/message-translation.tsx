"use client";

import { Languages, LoaderCircle, X } from "lucide-react";
import { useState } from "react";

export function MessageTranslation({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState("");
  const [language, setLanguage] = useState("");
  const [error, setError] = useState("");

  async function translate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/messages/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = await response.json().catch(() => null) as { error?: string; translation?: string; detectedLanguage?: string } | null;
      if (!response.ok || !body?.translation) throw new Error(body?.error || "No se pudo traducir.");
      setTranslation(body.translation);
      setLanguage(body.detectedLanguage || "Idioma detectado");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo traducir.");
    } finally {
      setLoading(false);
    }
  }

  if (translation) return <div className="mt-1.5 max-w-full rounded-xl border border-sky-400/15 bg-sky-400/[.05] px-3 py-2.5"><div className="mb-1.5 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-sky-300"><Languages className="size-3" />Español · {language}</span><button type="button" onClick={() => setTranslation("")} aria-label="Cerrar traducción" className="grid size-6 cursor-pointer place-items-center rounded-md text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-3" /></button></div><p className="whitespace-pre-wrap text-xs leading-5 text-zinc-300">{translation}</p></div>;

  return <div className="mt-1 flex items-center gap-2 px-1"><button type="button" disabled={loading} onClick={() => void translate()} className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-sky-400/80 hover:text-sky-300 disabled:cursor-wait disabled:opacity-60">{loading ? <LoaderCircle className="size-3 animate-spin" /> : <Languages className="size-3" />}{loading ? "Traduciendo…" : "Traducir al español"}</button>{error ? <span className="text-[10px] text-rose-300">{error}</span> : null}</div>;
}
