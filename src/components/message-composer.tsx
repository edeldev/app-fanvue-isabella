"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Check, FileText, LoaderCircle, Plus, Send, Sparkles } from "lucide-react";
import { MediaFields, type AttachedMedia } from "@/components/media-fields";

type Template = { id: string; name: string; text: string; category: string; media: AttachedMedia[]; priceMinor: number | null; previewUuid: string | null };
const categoryLabels: Record<string, string> = { WELCOME: "Bienvenida", FOLLOW_UP: "Seguimiento", RENEWAL: "Renovación", SALES: "Venta", VIP: "VIP", REACTIVATION: "Reactivación", GENERAL: "General" };

function renderTemplate(text: string, fanName: string, username: string) {
  return text.replaceAll("{{nombre}}", fanName).replaceAll("{{usuario}}", username ? `@${username}` : fanName);
}

export function MessageComposer({ fanUuid, fanName, username, templates }: { fanUuid: string; fanName: string; username: string; templates: Template[] }) {
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [command, setCommand] = useState<{ query: string; start: number; end: number } | null>(null);
  const [activeCommand, setActiveCommand] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const selected = useMemo(() => templates.find(template => template.id === templateId), [templateId, templates]);
  const matches = useMemo(() => {
    if (!command) return [];
    const query = command.query.toLocaleLowerCase("es");
    return templates.filter(template => template.name.toLocaleLowerCase("es").includes(query) || (categoryLabels[template.category] ?? template.category).toLocaleLowerCase("es").includes(query)).slice(0, 7);
  }, [command, templates]);

  function updateCommand(value: string, cursor: number) {
    const beforeCursor = value.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)\/([^\s/]*)$/);
    if (!match) { setCommand(null); return; }
    const slash = beforeCursor.lastIndexOf("/");
    setMediaOpen(false);
    setCommand({ query: match[1], start: slash, end: cursor });
    setActiveCommand(0);
  }

  function chooseTemplate(template: Template, range = command) {
    const rendered = renderTemplate(template.text, fanName, username);
    const start = range?.start ?? 0;
    const end = range?.end ?? text.length;
    const next = range ? text.slice(0, start) + rendered + text.slice(end) : rendered;
    setText(next); setTemplateId(template.id); setCommand(null);
    if (template.media.length) setMediaOpen(true);
    requestAnimationFrame(() => { const cursor = start + rendered.length; textarea.current?.focus(); textarea.current?.setSelectionRange(cursor, cursor); });
  }

  function insertVariable(variable: string) {
    const field = textarea.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? start;
    const rendered = variable === "{{nombre}}" ? fanName : username ? `@${username}` : fanName;
    setText(text.slice(0, start) + rendered + text.slice(end));
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + rendered.length, start + rendered.length); });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!command || matches.length === 0) {
      if (event.key === "Escape") setCommand(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCommand(current => event.key === "ArrowDown" ? (current + 1) % matches.length : (current - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseTemplate(matches[activeCommand]);
    } else if (event.key === "Escape") {
      event.preventDefault(); setCommand(null);
    }
  }

  return <form action="/api/messages/send" method="post" className="relative shrink-0 border-t border-white/8 bg-[#12141a] p-3">
    <input type="hidden" name="fanUuid" value={fanUuid} /><input type="hidden" name="templateId" value={templateId} />
    {command ? <div className="absolute bottom-[calc(100%-4px)] left-14 z-30 w-[min(430px,calc(100%-4.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1c23] shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3"><Sparkles className="size-4 text-violet-400" /><div><p className="text-xs font-medium text-zinc-200">Plantillas</p><p className="text-[10px] text-zinc-600">{command.query ? `Resultados para “${command.query}”` : "Escribe para buscar · ↑↓ para navegar · Enter para usar"}</p></div></div>
      <div className="max-h-72 overflow-y-auto">{matches.map((template, index) => <button key={template.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => chooseTemplate(template)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${index === activeCommand ? "bg-violet-500/15" : "hover:bg-white/5"}`}><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-300"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium text-zinc-200">{template.name}</span><span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-500">{categoryLabels[template.category] ?? template.category}</span></span><span className="mt-1 block truncate text-xs text-zinc-500">{renderTemplate(template.text, fanName, username) || `${template.media.length} archivos`}</span></span></button>)}{matches.length === 0 ? <div className="px-4 py-6 text-center text-xs text-zinc-500">No hay plantillas que coincidan.</div> : null}</div>
    </div> : null}
    <div className={mediaOpen ? "absolute bottom-[calc(100%-4px)] left-3 right-3 z-20 max-h-[60dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1c23] p-4 shadow-2xl shadow-black/50" : "hidden"}><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium text-zinc-200">Fotos, videos y PPV</p><p className="mt-0.5 text-[10px] text-zinc-600">Adjunta hasta 10 archivos y configura el precio.</p></div><button type="button" onClick={() => setMediaOpen(false)} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white">Cerrar</button></div><MediaFields key={templateId || "new"} initialMedia={selected?.media} initialPriceMinor={selected?.priceMinor} initialPreviewUuid={selected?.previewUuid} /></div>
    <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 shadow-inner focus-within:border-violet-500/45">
      <button type="button" aria-label="Agregar fotos y videos" title="Agregar fotos y videos" onClick={() => { setCommand(null); setMediaOpen(open => !open); }} className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${mediaOpen ? "rotate-45 bg-violet-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"}`}><Plus className="size-5" /></button>
      <div className="min-w-0 flex-1"><textarea ref={textarea} name="text" value={text} onChange={event => { setText(event.target.value); updateCommand(event.target.value, event.target.selectionStart); }} onClick={event => updateCommand(text, event.currentTarget.selectionStart)} onKeyDown={handleKeyDown} maxLength={5000} rows={1} placeholder="Escribe un mensaje o / para usar una plantilla…" className="max-h-32 min-h-10 w-full resize-none bg-transparent px-2 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600" /><div className="flex gap-1 px-2 pb-1">{["{{nombre}}", "{{usuario}}"].map(variable => <button key={variable} type="button" onClick={() => insertVariable(variable)} className="rounded px-1.5 py-0.5 font-mono text-[9px] text-zinc-600 hover:bg-violet-500/10 hover:text-violet-300">{variable}</button>)}</div></div>
      <SendMessageButton />
    </div>
  </form>;
}

function SendMessageButton() {
  const { pending } = useFormStatus();
  const sent = useSearchParams().has("sent");
  const label = pending ? "Enviando mensaje" : sent ? "Mensaje enviado" : "Enviar mensaje";

  return (
    <button
      type="submit"
      disabled={pending || sent}
      aria-label={label}
      aria-busy={pending}
      title={label}
      className={`grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-lg transition-all duration-200 ${sent ? "bg-emerald-500 shadow-emerald-950/30" : "bg-violet-500 shadow-violet-950/30 hover:bg-violet-400"} disabled:cursor-wait`}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : sent ? (
        <Check className="message-send-check size-5 stroke-[3]" />
      ) : (
        <Send className="size-4" />
      )}
    </button>
  );
}
