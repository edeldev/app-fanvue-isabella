"use client";

import { Braces, LoaderCircle, Save } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { MediaFields, type AttachedMedia } from "@/components/media-fields";

const categories = {
  WELCOME: "Bienvenida",
  FOLLOW_UP: "Seguimiento",
  RENEWAL: "Renovación",
  SALES: "Venta",
  VIP: "VIP",
  REACTIVATION: "Reactivación",
  GENERAL: "General",
};

export function TemplateForm({
  template,
}: {
  template?: {
    id: string;
    name: string;
    text: string;
    category: string;
    media: AttachedMedia[];
    priceMinor: number | null;
    previewUuid: string | null;
  };
}) {
  const [text, setText] = useState(template?.text ?? "");
  const textarea = useRef<HTMLTextAreaElement>(null);
  function insert(variable: string) {
    const field = textarea.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? start;
    setText(text.slice(0, start) + variable + text.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(
        start + variable.length,
        start + variable.length,
      );
    });
  }
  return (
    <form action="/api/templates" method="post" className="space-y-5">
      <input
        type="hidden"
        name="action"
        value={template ? "update" : "create"}
      />
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="mb-3 text-[10px] font-medium uppercase tracking-[.14em] text-zinc-600">Información básica</p><div className={template ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
        <label className="block text-xs text-zinc-500">
          Nombre
          <input
            required
            name="name"
            maxLength={80}
            defaultValue={template?.name}
            placeholder="Ej. Bienvenida personal"
            className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-violet-500/60"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Categoría
          <select
            name="category"
            defaultValue={template?.category ?? "GENERAL"}
            className="mt-2 w-full rounded-xl border border-white/8 bg-[#15171d] px-3 py-2.5 text-sm text-zinc-200 outline-none"
          >
            {Object.entries(categories).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div></div>
      <label className="block text-xs text-zinc-500">
        <span className="flex items-center justify-between"><span>Mensaje</span><span className="text-[10px] text-zinc-700">{text.length}/5000</span></span>
        <textarea
          ref={textarea}
          name="text"
          maxLength={5000}
          rows={template ? 5 : 7}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Hola {{nombre}}, gracias por seguirme…"
          className="mt-2 min-h-36 w-full resize-y rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-sm leading-6 text-zinc-200 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[.02] p-2.5">
        <span className="flex items-center gap-1.5 py-1 text-xs text-zinc-600"><Braces className="size-3.5" />Personalizar:</span>
        {["{{nombre}}", "{{usuario}}"].map((variable) => (
          <button
            key={variable}
            type="button"
            onClick={() => insert(variable)}
            className="rounded-md bg-violet-500/10 px-2 py-1 font-mono text-xs text-violet-300 hover:bg-violet-500/20"
          >
            {variable}
          </button>
        ))}
      </div>
      <MediaFields
        initialMedia={template?.media}
        initialPriceMinor={template?.priceMinor}
        initialPreviewUuid={template?.previewUuid}
      />
      <TemplateSubmitButton editing={Boolean(template)} />
    </form>
  );
}

function TemplateSubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/25 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear plantilla"}</button>;
}
