"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, CalendarClock, Check, Copy, FileText, Languages, LoaderCircle, Plus, RefreshCw, Send, Sparkles, WandSparkles, X } from "lucide-react";
import { MediaFields, type AttachedMedia } from "@/components/media-fields";
import { enqueueSnackbar } from "notistack";

type Template = { id: string; name: string; text: string; category: string; media: AttachedMedia[]; priceMinor: number | null; previewUuid: string | null };
const categoryLabels: Record<string, string> = { WELCOME: "Bienvenida", FOLLOW_UP: "Seguimiento", RENEWAL: "Renovación", SALES: "Venta", VIP: "VIP", REACTIVATION: "Reactivación", GENERAL: "General" };

function renderTemplate(text: string, fanName: string, username: string) {
  return text.replaceAll("{{nombre}}", fanName).replaceAll("{{usuario}}", username ? `@${username}` : fanName);
}

type ScheduledMessage = { id: string; text: string | null; scheduledAt: string; priceMinor: number | null; mediaCount: number };
type AiSuggestion = {
  reply: string;
  spanishTranslation: string;
  needsSpanishTranslation: boolean;
  detectedLanguage: string;
  tone: string;
  contextSummary: string;
};

export function MessageComposer({ fanUuid, fanName, username, templates, doNotMessage = false, scheduledMessages = [] }: { fanUuid: string; fanName: string; username: string; templates: Template[]; doNotMessage?: boolean; scheduledMessages?: ScheduledMessage[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [command, setCommand] = useState<{ query: string; start: number; end: number } | null>(null);
  const [activeCommand, setActiveCommand] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [cancelling, setCancelling] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiContextMessages, setAiContextMessages] = useState(0);
  const [aiError, setAiError] = useState("");
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

  async function cancelScheduled(id: string) {
    setCancelling(id);
    try {
      const response = await fetch(`/api/messages/scheduled/${id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "No se pudo cancelar el mensaje.");
      enqueueSnackbar("Mensaje programado cancelado.", { variant: "success" });
      router.refresh();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo cancelar el mensaje.", { variant: "error" });
    } finally { setCancelling(""); }
  }

  async function generateAiSuggestion() {
    setAiOpen(true);
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/messages/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fanUuid, currentDraft: text.trim() || undefined }),
      });
      const body = await response.json().catch(() => null) as { error?: string; suggestion?: AiSuggestion; contextMessages?: number } | null;
      if (!response.ok || !body?.suggestion) throw new Error(body?.error || "No se pudo generar una respuesta.");
      setAiSuggestion(body.suggestion);
      setAiContextMessages(body.contextMessages ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo generar una respuesta.";
      setAiError(message);
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setAiLoading(false);
    }
  }

  function useAiSuggestion() {
    if (!aiSuggestion) return;
    setText(aiSuggestion.reply);
    setTemplateId("");
    setCommand(null);
    setAiOpen(false);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(aiSuggestion.reply.length, aiSuggestion.reply.length);
    });
  }

  async function copyAiSuggestion() {
    if (!aiSuggestion) return;
    try {
      await navigator.clipboard.writeText(aiSuggestion.reply);
      enqueueSnackbar("Respuesta copiada.", { variant: "success" });
    } catch {
      enqueueSnackbar("No se pudo copiar la respuesta.", { variant: "error" });
    }
  }

  const scheduledAt = scheduledLocal ? new Date(scheduledLocal).toISOString() : "";

  return <form action="/api/messages/send" method="post" className="relative shrink-0 border-t border-white/8 bg-[#12141a] p-3">
    <input type="hidden" name="fanUuid" value={fanUuid} /><input type="hidden" name="templateId" value={templateId} /><input type="hidden" name="scheduledAt" value={scheduledAt} />
    {doNotMessage ? <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3"><p className="text-xs font-semibold text-rose-200">Fan marcado como “No contactar”</p><p className="mt-1 text-[11px] text-rose-200/60">Los mensajes manuales, programados y automáticos están bloqueados hasta retirar la preferencia.</p></div> : null}
    {scheduledMessages.length ? <div className="mb-3 rounded-xl border border-sky-400/15 bg-sky-400/[.04] p-3"><div className="flex items-center gap-2 text-xs font-medium text-sky-200"><CalendarClock className="size-4" />Próximos mensajes</div><div className="mt-2 space-y-1.5">{scheduledMessages.map((message) => <div key={message.id} className="flex items-center gap-3 rounded-lg bg-black/15 px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[11px] text-zinc-300">{message.text || `${message.mediaCount} archivo${message.mediaCount === 1 ? "" : "s"}${message.priceMinor ? ` · PPV $${(message.priceMinor / 100).toFixed(2)}` : ""}`}</p><time className="text-[10px] text-zinc-600">{new Date(message.scheduledAt).toLocaleString("es-MX")}</time></div><button type="button" disabled={cancelling === message.id} onClick={() => void cancelScheduled(message.id)} aria-label="Cancelar mensaje programado" className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-40">{cancelling === message.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <X className="size-3.5" />}</button></div>)}</div></div> : null}
    {aiOpen ? <section className="mb-3 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[.09] via-[#181922] to-fuchsia-500/[.04] shadow-xl shadow-black/15" aria-live="polite">
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Bot className="size-4" /></span><div><p className="text-sm font-semibold text-zinc-100">Asistente de respuesta</p><p className="text-[10px] text-zinc-500">Analiza el contexto reciente, tu estilo y el idioma del fan.</p></div></div>
        <button type="button" onClick={() => setAiOpen(false)} aria-label="Cerrar sugerencia de IA" className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></button>
      </div>
      {aiLoading ? <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-5 py-8 text-center"><span className="relative grid size-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><WandSparkles className="size-5" /><span className="absolute inset-0 animate-ping rounded-2xl border border-violet-400/20" /></span><div><p className="text-sm font-medium text-zinc-200">Leyendo la conversación…</p><p className="mt-1 text-xs text-zinc-500">Estoy detectando idioma, contexto y forma de responder.</p></div></div> : aiSuggestion ? <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/15 bg-violet-400/[.07] px-2.5 py-1 text-[10px] font-medium text-violet-200"><Languages className="size-3" />{aiSuggestion.detectedLanguage}</span><span className="rounded-full border border-white/8 bg-white/[.03] px-2.5 py-1 text-[10px] text-zinc-400">{aiSuggestion.tone}</span><span className="rounded-full border border-white/8 bg-white/[.03] px-2.5 py-1 text-[10px] text-zinc-500">{aiContextMessages} mensajes analizados</span></div>
        <div className="rounded-xl border border-white/8 bg-black/15 p-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-violet-300">Respuesta sugerida</p><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-100">{aiSuggestion.reply}</p></div>
        {aiSuggestion.needsSpanishTranslation ? <div className="rounded-xl border border-white/8 bg-black/10 px-4 py-3"><p className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-zinc-500"><Languages className="size-3.5" />Vista previa en español</p><p className="whitespace-pre-wrap text-xs leading-5 text-zinc-400">{aiSuggestion.spanishTranslation}</p></div> : null}
        <p className="px-1 text-[10px] leading-4 text-zinc-600"><span className="font-medium text-zinc-500">Contexto interpretado:</span> {aiSuggestion.contextSummary}</p>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void copyAiSuggestion()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"><Copy className="size-3.5" />Copiar</button><button type="button" onClick={() => void generateAiSuggestion()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white"><RefreshCw className="size-3.5" />Generar otra</button><button type="button" onClick={useAiSuggestion} className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-500 px-4 text-xs font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400"><WandSparkles className="size-3.5" />Usar respuesta</button></div>
      </div> : <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-5 py-6 text-center"><p className="max-w-md text-sm text-rose-200">{aiError || "No se pudo crear una sugerencia."}</p><button type="button" onClick={() => void generateAiSuggestion()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-200 hover:bg-white/5"><RefreshCw className="size-3.5" />Intentar otra vez</button></div>}
    </section> : null}
    {command ? <div className="absolute bottom-[calc(100%-4px)] left-14 z-30 w-[min(430px,calc(100%-4.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1c23] shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3"><Sparkles className="size-4 text-violet-400" /><div><p className="text-xs font-medium text-zinc-200">Plantillas</p><p className="text-[10px] text-zinc-600">{command.query ? `Resultados para “${command.query}”` : "Escribe para buscar · ↑↓ para navegar · Enter para usar"}</p></div></div>
      <div className="max-h-72 overflow-y-auto">{matches.map((template, index) => <button key={template.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => chooseTemplate(template)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${index === activeCommand ? "bg-violet-500/15" : "hover:bg-white/5"}`}><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-300"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium text-zinc-200">{template.name}</span><span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-500">{categoryLabels[template.category] ?? template.category}</span></span><span className="mt-1 block truncate text-xs text-zinc-500">{renderTemplate(template.text, fanName, username) || `${template.media.length} archivos`}</span></span></button>)}{matches.length === 0 ? <div className="px-4 py-6 text-center text-xs text-zinc-500">No hay plantillas que coincidan.</div> : null}</div>
    </div> : null}
    <div className={mediaOpen ? "absolute bottom-[calc(100%-4px)] left-3 right-3 z-20 max-h-[60dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1c23] p-4 shadow-2xl shadow-black/50" : "hidden"}><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium text-zinc-200">Fotos, videos y PPV</p><p className="mt-0.5 text-[10px] text-zinc-600">Adjunta hasta 10 archivos y configura el precio.</p></div><button type="button" onClick={() => setMediaOpen(false)} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white">Cerrar</button></div><MediaFields key={templateId || "new"} initialMedia={selected?.media} initialPriceMinor={selected?.priceMinor} initialPreviewUuid={selected?.previewUuid} /></div>
    <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 shadow-inner focus-within:border-violet-500/45">
      <button type="button" disabled={doNotMessage} aria-label="Agregar fotos y videos" title="Agregar fotos y videos" onClick={() => { setCommand(null); setMediaOpen(open => !open); }} className={`grid size-10 shrink-0 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-35 ${mediaOpen ? "rotate-45 bg-violet-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"}`}><Plus className="size-5" /></button>
      <div className="min-w-0 flex-1"><textarea ref={textarea} name="text" value={text} disabled={doNotMessage} onChange={event => { setText(event.target.value); updateCommand(event.target.value, event.target.selectionStart); }} onClick={event => updateCommand(text, event.currentTarget.selectionStart)} onKeyDown={handleKeyDown} maxLength={5000} rows={1} placeholder={doNotMessage ? "Mensajería bloqueada para este fan" : "Escribe un mensaje o / para usar una plantilla…"} className="max-h-32 min-h-10 w-full resize-none bg-transparent px-2 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50" /><div className="flex gap-1 px-2 pb-1">{["{{nombre}}", "{{usuario}}"].map(variable => <button key={variable} type="button" disabled={doNotMessage} onClick={() => insertVariable(variable)} className="rounded px-1.5 py-0.5 font-mono text-[9px] text-zinc-600 hover:bg-violet-500/10 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-35">{variable}</button>)}</div></div>
      <button type="button" disabled={doNotMessage || aiLoading} onClick={() => void generateAiSuggestion()} aria-label="Generar respuesta con IA" title="Generar respuesta con IA" className={`grid size-10 shrink-0 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-35 ${aiOpen ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-violet-300 hover:bg-violet-500/15 hover:text-violet-200"}`}>{aiLoading ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}</button>
      <button type="button" disabled={doNotMessage} onClick={() => setScheduleOpen((open) => !open)} aria-label="Programar mensaje" title="Programar mensaje" className={`grid size-10 shrink-0 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-35 ${scheduleOpen ? "bg-sky-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"}`}><CalendarClock className="size-4" /></button>
      <SendMessageButton scheduled={Boolean(scheduledLocal)} disabled={doNotMessage || (scheduleOpen && !scheduledLocal)} />
    </div>
    {scheduleOpen ? <div className="mt-2 flex flex-col gap-2 rounded-xl border border-sky-400/15 bg-sky-400/[.04] p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-sky-100">Programar para después</p><p className="mt-0.5 text-[10px] text-zinc-600">El cron lo enviará aunque cierres la aplicación.</p></div><input type="datetime-local" value={scheduledLocal} onChange={(event) => setScheduledLocal(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#171920] px-3 text-xs text-zinc-200 outline-none focus:border-sky-400/40" /><button type="button" onClick={() => { setScheduleOpen(false); setScheduledLocal(""); }} className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-white/5 hover:text-white">Cancelar</button></div> : null}
  </form>;
}

function SendMessageButton({ scheduled, disabled }: { scheduled: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  const sent = useSearchParams().has("sent");
  const label = pending ? scheduled ? "Programando mensaje" : "Enviando mensaje" : sent ? "Mensaje enviado" : scheduled ? "Programar mensaje" : "Enviar mensaje";

  return (
    <button
      type="submit"
      disabled={pending || sent || disabled}
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
