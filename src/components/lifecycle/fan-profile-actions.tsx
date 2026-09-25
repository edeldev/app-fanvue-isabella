"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import type { FanLifecycleStage } from "@prisma/client";
import { lifecyclePresentation, lifecycleStages } from "@/domain/lifecycle/presentation";

type Props = {
  fanId: string;
  stage: FanLifecycleStage;
  override: FanLifecycleStage | null;
  automationPaused: boolean;
  hasActiveWorkflow: boolean;
  tags: { id: string; name: string }[];
  notes: { id: string; body: string; createdAt: string }[];
};

export function FanProfileActions({ fanId, stage, override, automationPaused, hasActiveWorkflow, tags, notes }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
    <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-semibold text-white">Control del ciclo</h2><label className="mt-4 block text-xs text-zinc-500">Etapa manual</label><select disabled={busy} value={override ?? ""} onChange={(event) => mutate({ action: "SET_STAGE", stage: event.target.value || null }, event.target.value ? "Etapa fijada manualmente" : "Cálculo automático restaurado")} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#171920] px-3 text-sm text-white outline-none focus:border-violet-400/50"><option value="">Automática · {lifecyclePresentation[stage].label}</option>{lifecycleStages.map((item) => <option key={item} value={item}>{lifecyclePresentation[item].label}</option>)}</select><p className="mt-2 text-[11px] leading-5 text-zinc-600">Si quitas la selección, el sistema vuelve a calcularla con datos reales.</p><div className="mt-4 rounded-xl border border-white/6 bg-black/10 p-3"><p className="text-xs font-medium text-zinc-300">{automationPaused ? "Automatizaciones bloqueadas" : hasActiveWorkflow ? "Tiene un workflow activo" : "Sin workflows activos"}</p><p className="mt-1 text-[11px] leading-5 text-zinc-600">{automationPaused ? "No recibirá automatizaciones hasta que lo reanudes." : hasActiveWorkflow ? "La pausa detendrá el workflow actual y bloqueará los futuros." : "Puedes bloquear preventivamente los workflows que se disparen en el futuro."}</p></div><button disabled={busy} onClick={() => mutate({ action: "SET_AUTOMATION_PAUSE", paused: !automationPaused }, automationPaused ? "Automatización reanudada" : "Automatización pausada")} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${automationPaused ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{automationPaused ? <Play className="size-4"/> : <Pause className="size-4"/>}{automationPaused ? "Reanudar automatización" : hasActiveWorkflow ? "Pausar workflow y automatizaciones" : "Bloquear automatizaciones futuras"}</button></section>
    <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-semibold text-white">Etiquetas</h2><div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <button key={tag.id} disabled={busy} onClick={() => mutate({ action: "REMOVE_TAG", tagId: tag.id }, "Etiqueta eliminada")} className="group flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-300">{tag.name}<span className="text-violet-300/40 group-hover:text-violet-200">×</span></button>)}</div><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const input = new FormData(form).get("tag"); if (typeof input === "string" && input.trim()) void mutate({ action: "ADD_TAG", name: input.trim() }, "Etiqueta agregada").then(() => form.reset()); }}><input name="tag" maxLength={40} placeholder="Ej. le gusta cosplay" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111319] px-3 text-sm outline-none focus:border-violet-400/50"/><button disabled={busy} aria-label="Agregar etiqueta" className="grid size-10 place-items-center rounded-xl bg-violet-500 text-white"><Plus className="size-4"/></button></form></section>
    <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-semibold text-white">Notas privadas</h2><form className="mt-4" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const body = new FormData(form).get("note"); if (typeof body === "string" && body.trim()) void mutate({ action: "ADD_NOTE", body: body.trim() }, "Nota guardada").then(() => form.reset()); }}><textarea name="note" maxLength={2000} rows={3} placeholder="Contexto útil, preferencias o seguimiento…" className="w-full resize-none rounded-xl border border-white/10 bg-[#111319] p-3 text-sm leading-6 outline-none focus:border-violet-400/50"/><button disabled={busy} className="mt-2 w-full rounded-xl bg-white/8 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/12">Guardar nota</button></form><div className="mt-4 space-y-2">{notes.map((note) => <article key={note.id} className="rounded-xl border border-white/6 bg-black/10 p-3"><p className="whitespace-pre-wrap text-xs leading-5 text-zinc-400">{note.body}</p><div className="mt-2 flex items-center justify-between"><time className="text-[10px] text-zinc-700">{new Date(note.createdAt).toLocaleString("es-MX")}</time><button disabled={busy} onClick={() => mutate({ action: "DELETE_NOTE", noteId: note.id }, "Nota eliminada")} aria-label="Eliminar nota" className="text-zinc-700 hover:text-rose-300"><Trash2 className="size-3.5"/></button></div></article>)}</div></section>
  </div>;
}
