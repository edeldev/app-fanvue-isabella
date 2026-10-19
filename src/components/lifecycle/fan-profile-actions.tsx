"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareOff, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import type { FanLifecycleStage } from "@prisma/client";
import { lifecyclePresentation, lifecycleStages } from "@/domain/lifecycle/presentation";

type Props = {
  fanId: string;
  stage: FanLifecycleStage;
  override: FanLifecycleStage | null;
  automationPaused: boolean;
  doNotMessage: boolean;
  doNotMessageReason: string | null;
  intimateContentOptIn: boolean;
  intimateContentOptInAt: string | null;
  intimateContentOptInSource: string | null;
  consentEvidenceMessages: { id: string; text: string; sentAt: string }[];
  hasActiveWorkflow: boolean;
  tags: { id: string; name: string }[];
  notes: { id: string; body: string; createdAt: string }[];
};

export function FanProfileActions({ fanId, stage, override, automationPaused, doNotMessage, doNotMessageReason, intimateContentOptIn, intimateContentOptInAt, intimateContentOptInSource, consentEvidenceMessages, hasActiveWorkflow, tags, notes }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [evidenceMessageId, setEvidenceMessageId] = useState("");
  const [consentAttested, setConsentAttested] = useState(false);
  const consentVerified = intimateContentOptIn && Boolean(intimateContentOptInSource?.startsWith("fanvue-message:") && intimateContentOptInSource.length > "fanvue-message:".length);
  const mutate = async (body: object, success: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/lifecycle/fans/${fanId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "No se pudo guardar");
      enqueueSnackbar(success, { variant: "success" });
      router.refresh();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo guardar", { variant: "error" });
    } finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <section className={`rounded-2xl border p-5 ${doNotMessage ? "border-rose-400/25 bg-rose-400/[.06]" : "border-white/8 bg-white/[.025]"}`}><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${doNotMessage ? "bg-rose-400/15 text-rose-300" : "bg-white/5 text-zinc-500"}`}><MessageSquareOff className="size-5"/></span><div><h2 className="font-semibold text-white">Preferencia de contacto</h2><p className="mt-1 text-[11px] leading-5 text-zinc-500">Protege al fan contra mensajes manuales, programados y automáticos.</p></div></div>{doNotMessage ? <div className="mt-4 rounded-xl border border-rose-400/15 bg-black/10 p-3"><p className="text-xs font-medium text-rose-200">No enviar mensajes</p><p className="mt-1 text-[11px] leading-5 text-rose-200/55">{doNotMessageReason || "Preferencia activada manualmente."}</p></div> : null}<button disabled={busy} onClick={() => mutate({ action: "SET_DO_NOT_MESSAGE", blocked: !doNotMessage }, doNotMessage ? "El fan puede volver a recibir mensajes" : "Fan agregado a la lista de no contactar")} className={`mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${doNotMessage ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-rose-400/20 bg-rose-400/8 text-rose-200 hover:bg-rose-400/12"}`}><MessageSquareOff className="size-4"/>{doNotMessage ? "Permitir mensajes nuevamente" : "Marcar como no contactar"}</button></section>
    <section className={`rounded-2xl border p-5 ${consentVerified ? "border-emerald-400/20 bg-emerald-400/[.04]" : "border-amber-400/15 bg-amber-400/[.03]"}`}>
      <div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${consentVerified ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}><ShieldCheck className="size-5"/></span><div><h2 className="font-semibold text-white">Consentimiento de contenido</h2><p className="mt-1 text-[11px] leading-5 text-zinc-500">Para fans no suscritos, vincula el consentimiento a un mensaje recibido que exprese claramente que desean este contenido.</p></div></div>
      {consentVerified ? <><p className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 className="size-4"/>Consentimiento con evidencia{intimateContentOptInAt ? ` · ${new Date(intimateContentOptInAt).toLocaleDateString("es-MX")}` : ""}</p><button type="button" disabled={busy} onClick={() => mutate({ action: "SET_INTIMATE_CONTENT_CONSENT", consented: false }, "Consentimiento retirado")} className="mt-4 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[.035] px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/[.06] disabled:opacity-50">Retirar consentimiento</button></> : <>
        {intimateContentOptIn ? <p className="mt-4 text-xs leading-5 text-amber-200">El registro anterior no tiene un mensaje verificable; no autoriza nuevos envíos de contenido hasta que lo vincules.</p> : null}
        <label className="mt-4 block text-xs text-zinc-400">Mensaje del fan que da consentimiento
          <select value={evidenceMessageId} onChange={(event) => { setEvidenceMessageId(event.target.value); setConsentAttested(false); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#171920] px-3 py-2.5 text-xs text-zinc-200"><option value="">Selecciona un mensaje recibido…</option>{consentEvidenceMessages.map((message) => <option key={message.id} value={message.id}>{new Date(message.sentAt).toLocaleDateString("es-MX")} · {message.text.slice(0, 100)}</option>)}</select>
        </label>
        {consentEvidenceMessages.find((message) => message.id === evidenceMessageId) ? <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/8 bg-black/15 p-3 text-xs leading-5 text-zinc-300">{consentEvidenceMessages.find((message) => message.id === evidenceMessageId)?.text}</p> : null}
        {consentEvidenceMessages.length === 0 ? <p className="mt-2 text-xs text-amber-200">No hay mensajes de texto recibidos para usar como evidencia. Pide primero el consentimiento en Fanvue.</p> : null}
        <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" checked={consentAttested} onChange={(event) => setConsentAttested(event.target.checked)} className="mt-1 accent-emerald-400"/>Leí el mensaje completo y confirmo que el fan aceptó recibir contenido íntimo; una conversación general o una compra no basta.</label>
        <button type="button" disabled={busy || !evidenceMessageId || !consentAttested} onClick={() => mutate({ action: "SET_INTIMATE_CONTENT_CONSENT", consented: true, evidenceMessageId, attested: true }, "Consentimiento vinculado al mensaje")} className="mt-4 w-full cursor-pointer rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40">Registrar consentimiento con evidencia</button>
        {intimateContentOptIn ? <button type="button" disabled={busy} onClick={() => mutate({ action: "SET_INTIMATE_CONTENT_CONSENT", consented: false }, "Registro anterior retirado")} className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-xs text-zinc-400 hover:text-white disabled:opacity-50">Retirar registro anterior</button> : null}
      </>}
    </section>
    <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-semibold text-white">Control del ciclo</h2><label className="mt-4 block text-xs text-zinc-500">Etapa manual</label><select disabled={busy} value={override ?? ""} onChange={(event) => mutate({ action: "SET_STAGE", stage: event.target.value || null }, event.target.value ? "Etapa fijada manualmente" : "Cálculo automático restaurado")} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#171920] px-3 text-sm text-white outline-none focus:border-violet-400/50"><option value="">Automática · {lifecyclePresentation[stage].label}</option>{lifecycleStages.map((item) => <option key={item} value={item}>{lifecyclePresentation[item].label}</option>)}</select><p className="mt-2 text-[11px] leading-5 text-zinc-600">Si quitas la selección, el sistema vuelve a calcularla con datos reales.</p><div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 p-4"><div><p className="text-sm font-medium text-white">Excluir de todos los flujos</p><p className="mt-1 text-[11px] leading-5 text-zinc-500">{automationPaused ? "Excluido: no entrará al volver a seguir, suscribirse o renovar." : "Puede entrar a flujos por nuevos eventos."} {hasActiveWorkflow ? "Los flujos actuales se pausarán al activar esta opción." : "Los mensajes manuales siguen disponibles; usa ‘No contactar’ si deseas bloquearlos también."}</p></div><button type="button" role="switch" aria-checked={automationPaused} aria-label="Excluir de todos los flujos" disabled={busy} onClick={() => mutate({ action: "SET_AUTOMATION_PAUSE", paused: !automationPaused }, automationPaused ? "El fan puede volver a entrar en flujos" : "Fan excluido de los flujos")} className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${automationPaused ? "bg-violet-500" : "bg-zinc-700"}`}><span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${automationPaused ? "translate-x-5" : "translate-x-0"}`}/></button></div>{automationPaused && hasActiveWorkflow ? <p className="mt-2 text-[11px] text-amber-300">Al desactivar la exclusión, los flujos pausados por este motivo podrán continuar.</p> : null}</section>
    <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-semibold text-white">Etiquetas</h2><div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <button key={tag.id} disabled={busy} onClick={() => mutate({ action: "REMOVE_TAG", tagId: tag.id }, "Etiqueta eliminada")} className="group flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-300">{tag.name}<span className="text-violet-300/40 group-hover:text-violet-200">×</span></button>)}</div><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const input = new FormData(form).get("tag"); if (typeof input === "string" && input.trim()) void mutate({ action: "ADD_TAG", name: input.trim() }, "Etiqueta agregada").then(() => form.reset()); }}><input name="tag" maxLength={40} placeholder="Ej. le gusta cosplay" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111319] px-3 text-sm outline-none focus:border-violet-400/50"/><button disabled={busy} aria-label="Agregar etiqueta" className="grid size-10 place-items-center rounded-xl bg-violet-500 text-white"><Plus className="size-4"/></button></form></section>
    <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-semibold text-white">Notas privadas</h2><form className="mt-4" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const body = new FormData(form).get("note"); if (typeof body === "string" && body.trim()) void mutate({ action: "ADD_NOTE", body: body.trim() }, "Nota guardada").then(() => form.reset()); }}><textarea name="note" maxLength={2000} rows={3} placeholder="Contexto útil, preferencias o seguimiento…" className="w-full resize-none rounded-xl border border-white/10 bg-[#111319] p-3 text-sm leading-6 outline-none focus:border-violet-400/50"/><button disabled={busy} className="mt-2 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/12">Guardar nota</button></form><div className="mt-4 space-y-2">{notes.map((note) => <article key={note.id} className="rounded-xl border border-white/6 bg-black/10 p-3"><p className="whitespace-pre-wrap text-xs leading-5 text-zinc-400">{note.body}</p><div className="mt-2 flex items-center justify-between"><time className="text-[10px] text-zinc-700">{new Date(note.createdAt).toLocaleString("es-MX")}</time><button disabled={busy} onClick={() => mutate({ action: "DELETE_NOTE", noteId: note.id }, "Nota eliminada")} aria-label="Eliminar nota" className="text-zinc-700 hover:text-rose-300"><Trash2 className="size-3.5"/></button></div></article>)}</div></section>
  </div>;
}
