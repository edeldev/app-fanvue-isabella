"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Clock3, Edit3, Plus, Rocket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { stepTypeLabels, type WorkflowDefinitionInput } from "@/domain/workflows/definition";
import { WorkflowEditor } from "./workflow-editor";
import { WorkflowDeleteDialog } from "./workflow-delete-dialog";
import { workflowStepContext } from "./step-context";
import type { TemplateOption, WorkflowView } from "./types";

export function WorkflowManager({ workflows, templates }: { workflows: WorkflowView[]; templates: TemplateOption[] }) {
  const router = useRouter();
  const [editor, setEditor] = useState<WorkflowView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkflowView | null>(null);
  const templateNames = new Map(templates.map((template) => [template.id, template.name]));
  const workflowNames = new Map(workflows.map((workflow) => [workflow.id, workflow.name]));

  async function request(url: string, options: RequestInit, successText = "Cambios guardados correctamente.") {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(url, options);
      const body = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(body?.error ?? "La operación no pudo completarse.");
      setMessage({ text: successText });
      setEditor(undefined);
      router.refresh();
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? translateError(error.message) : "Ocurrió un error." });
    } finally { setBusy(false); }
  }

  const save = (input: WorkflowDefinitionInput) => request(editor?.id ? `/api/workflows/${editor.id}` : "/api/workflows", {
    method: editor?.id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  function remove(workflow: WorkflowView) {
    setPendingDelete(workflow);
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
    <section><div className="mb-4 flex items-center justify-between"><div><h2 className="font-medium text-white">Estrategias</h2><p className="mt-1 text-xs text-zinc-500">Versiones publicadas inmutables y borradores editables.</p></div><button onClick={() => setEditor(null)} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"><Plus className="size-4" />Nuevo flujo</button></div>
      {message ? <div role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${message.error ? "border-red-400/20 bg-red-400/8 text-red-200" : "border-emerald-400/20 bg-emerald-400/8 text-emerald-200"}`}>{message.text}</div> : null}
      <div className="space-y-3">{workflows.map((workflow) => <article key={workflow.id} className="rounded-2xl border border-white/8 bg-white/[.03] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-white">{workflow.name}</h3><Status status={workflow.status} /></div><p className="mt-1 text-xs text-zinc-500">Versión {workflow.version} · Prioridad {workflow.priority} · {workflow.isPrimary ? "Principal" : "Secundario"}</p></div><div className="flex gap-2">{workflow.status === "DRAFT" ? <button onClick={() => setEditor(workflow)} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:text-white" aria-label={`Editar ${workflow.name}`}><Edit3 className="size-4" /></button> : null}{workflow.status === "DRAFT" || (workflow.status === "PUBLISHED" && workflow.activeEnrollments === 0) ? <button disabled={busy} onClick={() => remove(workflow)} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:text-red-300" aria-label={`Eliminar ${workflow.name}`} title={workflow.status === "PUBLISHED" ? "Eliminar workflow sin ejecuciones activas" : "Eliminar borrador"}><Trash2 className="size-4" /></button> : null}{workflow.status === "DRAFT" ? <button disabled={busy} onClick={() => request(`/api/workflows/${workflow.id}/publish`, { method: "POST" })} className="flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15"><Rocket className="size-3.5" />Publicar</button> : null}</div></div>
        <div className="mt-4 flex flex-wrap items-stretch gap-2">{workflow.steps.map((step, index) => { const context = workflowStepContext(step, templateNames, workflowNames); return <div key={`${workflow.id}-${index}`} className="flex items-center gap-2"><div className="min-w-32 rounded-xl border border-white/8 bg-black/15 px-3 py-2"><p className="text-[11px] font-medium text-zinc-300">{index + 1}. {stepTypeLabels[step.type]}</p>{context ? <p className="mt-1 max-w-48 truncate text-[10px] text-violet-300/75" title={context}>{context}</p> : <p className="mt-1 text-[10px] text-zinc-600">Cierra el flujo</p>}</div>{index < workflow.steps.length - 1 ? <span className="text-zinc-700">→</span> : null}</div>; })}</div><div className="mt-4 flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-zinc-600"><span className="flex items-center gap-1.5"><Bot className="size-3.5" />{workflow.enrollments} enrollments</span>{workflow.publishedAt ? <span className="flex items-center gap-1.5"><Clock3 className="size-3.5" />Publicado {new Date(workflow.publishedAt).toLocaleDateString("es-MX")}</span> : null}</div>
      </article>)}{!workflows.length ? <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.02] text-center"><div><Bot className="mx-auto mb-3 size-8 text-zinc-700" /><p className="text-sm font-medium text-zinc-300">Aún no hay workflows</p><p className="mt-1 text-xs text-zinc-600">Crea la primera estrategia automatizada.</p></div></div> : null}</div>
    </section>
    <aside>{editor !== undefined ? <WorkflowEditor key={editor?.id ?? "new"} value={editor} templates={templates} publishedWorkflows={workflows.filter((workflow) => workflow.status === "PUBLISHED")} busy={busy} onClose={() => setEditor(undefined)} onSave={save} /> : <div className="rounded-2xl border border-white/8 bg-white/[.025] p-6"><CheckCircle2 className="mb-4 size-7 text-violet-400" /><h2 className="font-medium text-white">Diseño seguro</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Cada acción pasará por Validation Guard antes de ejecutarse. Publicar congela esta versión para que los enrollments sean reproducibles.</p><div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200/80"><strong>SEND_OFFER</strong> permanece deshabilitado: NOT_SUPPORTED_BY_CURRENT_FANVUE_API.</div></div>}</aside>
    {pendingDelete ? <WorkflowDeleteDialog workflow={pendingDelete} busy={busy} onCancel={() => setPendingDelete(null)} onConfirm={() => { void request(`/api/workflows/${pendingDelete.id}`, { method: "DELETE" }, "Workflow eliminado correctamente.").then(() => setPendingDelete(null)); }} /> : null}
  </div>;
}

function Status({ status }: { status: WorkflowView["status"] }) {
  const styles = status === "PUBLISHED" ? "bg-emerald-400/10 text-emerald-300" : status === "DRAFT" ? "bg-amber-400/10 text-amber-300" : "bg-zinc-400/10 text-zinc-400";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${styles}`}>{status === "PUBLISHED" ? "Publicado" : status === "DRAFT" ? "Borrador" : "Archivado"}</span>;
}

function translateError(message: string) {
  const errors: Record<string, string> = { WORKFLOW_IMMUTABLE: "Los flujos publicados no se pueden editar.", WORKFLOW_NOT_FOUND: "El flujo no existe.", WORKFLOW_TEMPLATE_NOT_FOUND: "Una plantilla seleccionada no existe.", WORKFLOW_TARGET_NOT_FOUND: "El flujo de destino debe estar publicado.", WORKFLOW_IS_RUNNING: "Cancela o finaliza todos los enrollments activos antes de eliminar este workflow." };
  return errors[message] ?? message;
}
