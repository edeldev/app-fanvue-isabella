"use client";

import { useRef, useState } from "react";
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
    <form action="/api/templates" method="post" className="space-y-4">
      <input
        type="hidden"
        name="action"
        value={template ? "update" : "create"}
      />
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className={template ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
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
      </div>
      <label className="block text-xs text-zinc-500">
        Mensaje
        <textarea
          ref={textarea}
          name="text"
          maxLength={5000}
          rows={template ? 5 : 7}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Hola {{nombre}}, gracias por seguirme…"
          className="mt-2 w-full resize-y rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-zinc-200 outline-none focus:border-violet-500/60"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <span className="py-1 text-xs text-zinc-600">Insertar:</span>
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
      <button
        className={
          template
            ? "rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white"
            : "w-full rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white"
        }
      >
        {template ? "Guardar cambios" : "Crear plantilla"}
      </button>
    </form>
  );
}
