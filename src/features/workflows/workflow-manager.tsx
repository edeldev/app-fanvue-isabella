"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  GitBranch,
  Layers3,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { stepTypeLabels, type WorkflowDefinitionInput } from "@/domain/workflows/definition";
import { workflowReentryPolicyLabels } from "@/domain/workflows/reentry-policy";
import { workflowTriggerLabels } from "@/domain/workflows/triggers";
import { WorkflowDeleteDialog } from "./workflow-delete-dialog";
import { WorkflowEditor } from "./workflow-editor";
import { workflowStepContext } from "./step-context";
import type { TemplateOption, WorkflowAnalyticsView, WorkflowDefaultsView, WorkflowView } from "./types";

const PAGE_SIZE = 6;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
type StatusFilter = "ALL" | WorkflowView["status"];

export function WorkflowManager({ workflows, templates, defaults, analytics }: {
  workflows: WorkflowView[];
  templates: TemplateOption[];
  defaults: WorkflowDefaultsView;
  analytics: WorkflowAnalyticsView[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<WorkflowView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkflowView | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const templateNames = useMemo(() => new Map(templates.map((template) => [template.id, template.name])), [templates]);
  const workflowNames = useMemo(() => new Map(workflows.map((workflow) => [workflow.id, workflow.name])), [workflows]);
  const analyticsByWorkflow = useMemo(() => new Map(analytics.map((item) => [item.workflowId, item])), [analytics]);
  const filtered = workflows.filter((workflow) => {
    const normalized = query.trim().toLocaleLowerCase("es-MX");
    const matchesText = !normalized || workflow.name.toLocaleLowerCase("es-MX").includes(normalized)
      || workflowTriggerLabels[workflow.triggerEvent].toLocaleLowerCase("es-MX").includes(normalized)
      || workflow.steps.some((step) => step.name.toLocaleLowerCase("es-MX").includes(normalized));
    return matchesText && (status === "ALL" || workflow.status === status);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function request(url: string, options: RequestInit, successText = "Cambios guardados correctamente.") {
    setBusy(true);
    try {
      const response = await fetch(url, options);
      const body = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(body?.error ?? "La operación no pudo completarse.");
      enqueueSnackbar(successText, { variant: "success" });
      setEditor(undefined);
      router.refresh();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? translateError(error.message) : "Ocurrió un error.", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const save = (input: WorkflowDefinitionInput) => request(editor?.id ? `/api/workflows/${editor.id}` : "/api/workflows", {
    method: editor?.id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (editor !== undefined) {
    return <section>
      <button type="button" onClick={() => setEditor(undefined)} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"><ChevronLeft className="size-4" />Volver a mis workflows</button>
      <WorkflowEditor key={editor?.id ?? "new"} value={editor} defaults={defaults} templates={templates} publishedWorkflows={workflows.filter((workflow) => workflow.status === "PUBLISHED" && workflow.isPrimary)} busy={busy} onClose={() => setEditor(undefined)} onSave={save} />
    </section>;
  }

  const statusCounts = {
    ALL: workflows.length,
    DRAFT: workflows.filter((workflow) => workflow.status === "DRAFT").length,
    PUBLISHED: workflows.filter((workflow) => workflow.status === "PUBLISHED").length,
    ARCHIVED: workflows.filter((workflow) => workflow.status === "ARCHIVED").length,
  };

  return <section>
    <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-medium text-white">Mis workflows</h2><p className="mt-1 text-xs text-zinc-500">Busca, filtra y abre solo el flujo que quieras revisar.</p></div>
        <button onClick={() => setEditor(null)} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400"><Plus className="size-4" />Nuevo flujo</button>
      </div>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 focus-within:border-violet-400/40"><Search className="size-4 text-zinc-600" /><span className="sr-only">Buscar workflows</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por nombre, disparador o paso…" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />{query ? <button type="button" onClick={() => { setQuery(""); setPage(1); }} aria-label="Limpiar búsqueda" className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-4" /></button> : null}</label>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-black/15 p-1">{(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((item) => <button key={item} type="button" onClick={() => { setStatus(item); setPage(1); }} className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${status === item ? "bg-violet-500 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}>{statusLabel(item)} <span className="ml-1 opacity-60">{statusCounts[item]}</span></button>)}</div>
      </div>
    </div>

    <div className="mt-4 grid gap-3 xl:grid-cols-2">{visible.map((workflow) => {
      const result = analyticsByWorkflow.get(workflow.id);
      return <article key={workflow.id} className="group overflow-hidden rounded-2xl border border-white/8 bg-[#15171d] transition hover:border-white/14 hover:bg-[#171920]">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-white">{workflow.name}</h3><Status status={workflow.status} /></div><p className="mt-1.5 text-xs text-zinc-600">v{workflow.version} · Prioridad {workflow.priority} · {workflow.isPrimary ? "Principal" : "Secundario"}</p></div>
            <div className="flex shrink-0 gap-1">{workflow.status === "DRAFT" ? <button onClick={() => setEditor(workflow)} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label={`Editar ${workflow.name}`}><Edit3 className="size-4" /></button> : null}{workflow.status === "DRAFT" || (workflow.status === "PUBLISHED" && workflow.activeEnrollments === 0) ? <button disabled={busy} onClick={() => setPendingDelete(workflow)} className="rounded-lg border border-white/8 p-2 text-zinc-500 hover:bg-red-400/8 hover:text-red-300" aria-label={`Eliminar ${workflow.name}`}><Trash2 className="size-4" /></button> : null}{workflow.status === "DRAFT" ? <button disabled={busy} onClick={() => request(`/api/workflows/${workflow.id}/publish`, { method: "POST" })} className="flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15"><Rocket className="size-3.5" />Publicar</button> : null}</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickFact icon={GitBranch} label="Inicia" value={workflowTriggerLabels[workflow.triggerEvent]} />
            <QuickFact icon={Layers3} label="Pasos" value={String(workflow.steps.length)} />
            <QuickFact icon={Users} label="Ejecuciones" value={String(workflow.enrollments)} />
            <QuickFact icon={Target} label="Conversión" value={result ? `${result.conversionRate.toFixed(1)}%` : "—"} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-zinc-600"><span>{workflowReentryPolicyLabels[workflow.reentryPolicy]}{workflow.reentryPolicy === "AFTER_DELAY" ? ` · ${workflow.reentryDelayDays} días` : ""}</span>{result?.messagesSent ? <span className="flex items-center gap-1"><MessageSquare className="size-3" />{result.messagesSent} mensajes</span> : null}{result?.attributedRevenueMinor ? <span className="font-medium text-emerald-400">{money.format(result.attributedRevenueMinor / 100)} atribuido</span> : null}{workflow.publishedAt ? <span className="ml-auto flex items-center gap-1"><Clock3 className="size-3" />{new Date(workflow.publishedAt).toLocaleDateString("es-MX")}</span> : null}</div>
        </div>
        <details className="border-t border-white/6"><summary className="cursor-pointer list-none px-5 py-3 text-xs text-zinc-500 transition hover:bg-white/[.025] hover:text-zinc-300 [&::-webkit-details-marker]:hidden">Ver estructura del flujo <span className="ml-1 text-zinc-700">→</span></summary><div className="border-t border-white/6 bg-black/10 px-4 py-4"><div className="flex gap-2 overflow-x-auto pb-1">{workflow.steps.map((step, index) => { const context = workflowStepContext(step, templateNames, workflowNames); return <div key={`${workflow.id}-${index}`} className="flex shrink-0 items-center gap-2"><div className="w-40 rounded-xl border border-white/8 bg-[#181a21] px-3 py-2"><p className="truncate text-[11px] font-medium text-zinc-300">{index + 1}. {step.name}</p><p className="mt-1 truncate text-[10px] text-violet-300/70" title={context ?? stepTypeLabels[step.type]}>{context ?? stepTypeLabels[step.type]}</p></div>{index < workflow.steps.length - 1 ? <span className="text-zinc-700">→</span> : null}</div>; })}</div></div></details>
      </article>;
    })}</div>

    {!visible.length ? <div className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.02] text-center"><div><Bot className="mx-auto mb-3 size-8 text-zinc-700" /><p className="text-sm font-medium text-zinc-300">No encontramos workflows</p><p className="mt-1 text-xs text-zinc-600">Cambia el filtro o limpia la búsqueda.</p></div></div> : null}

    {filtered.length > PAGE_SIZE ? <nav aria-label="Paginación de workflows" className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-4 py-3"><p className="text-xs text-zinc-600">Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}</p><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-25"><ChevronLeft className="size-4" /></button><span className="min-w-16 text-center text-xs text-zinc-500">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight className="size-4" /></button></div></nav> : null}

    <div className="mt-5 rounded-2xl border border-violet-400/12 bg-violet-400/[.025] p-5"><CheckCircle2 className="mb-3 size-6 text-violet-400" /><h2 className="text-sm font-medium text-white">Diseño seguro</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">Cada acción pasa por Validation Guard. Publicar congela esa versión para que los enrollments en curso nunca cambien inesperadamente.</p></div>
    {pendingDelete ? <WorkflowDeleteDialog workflow={pendingDelete} busy={busy} onCancel={() => setPendingDelete(null)} onConfirm={() => { void request(`/api/workflows/${pendingDelete.id}`, { method: "DELETE" }, "Workflow eliminado correctamente.").then(() => setPendingDelete(null)); }} /> : null}
  </section>;
}

function QuickFact({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/6 bg-black/12 p-2.5"><Icon className="size-3.5 text-violet-400/70" /><p className="mt-2 truncate text-xs font-medium text-zinc-300" title={value}>{value}</p><p className="mt-0.5 text-[9px] uppercase tracking-wide text-zinc-700">{label}</p></div>;
}

function Status({ status }: { status: WorkflowView["status"] }) {
  const styles = status === "PUBLISHED" ? "bg-emerald-400/10 text-emerald-300" : status === "DRAFT" ? "bg-amber-400/10 text-amber-300" : "bg-zinc-400/10 text-zinc-400";
  const label = status === "PUBLISHED" ? "Publicado" : status === "DRAFT" ? "Borrador" : "Archivado";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${styles}`}>{label}</span>;
}

function statusLabel(status: StatusFilter) {
  return status === "ALL" ? "Todos" : status === "PUBLISHED" ? "Publicados" : status === "DRAFT" ? "Borradores" : "Archivados";
}

function translateError(message: string) {
  const errors: Record<string, string> = {
    WORKFLOW_IMMUTABLE: "Los flujos publicados no se pueden editar.",
    WORKFLOW_NOT_FOUND: "El flujo no existe.",
    WORKFLOW_TEMPLATE_NOT_FOUND: "Una plantilla seleccionada no existe.",
    WORKFLOW_TARGET_NOT_FOUND: "El flujo de destino debe estar publicado y ser principal.",
    WORKFLOW_IS_RUNNING: "Cancela o finaliza todos los enrollments activos antes de eliminar este workflow.",
    WORKFLOW_PPV_TEMPLATE_INVALID: "El PPV necesita una plantilla con precio, vista gratuita y al menos un archivo bloqueado.",
    WORKFLOW_MESSAGE_TEMPLATE_HAS_PRICE: "Enviar mensaje requiere una plantilla sin precio; usa Enviar PPV para contenido de pago.",
  };
  return errors[message] ?? message;
}
