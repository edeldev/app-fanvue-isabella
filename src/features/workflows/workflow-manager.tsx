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
  DollarSign,
  Edit3,
  GitBranch,
  Layers3,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { WorkflowDefinitionInput } from "@/domain/workflows/definition";
import { workflowReentryPolicyLabels } from "@/domain/workflows/reentry-policy";
import { workflowTriggerLabels } from "@/domain/workflows/triggers";
import { workflowGoalLabels } from "@/domain/workflows/conversion-goal";
import { formatAppDate } from "@/lib/date-time";
import { WorkflowDeleteDialog } from "./workflow-delete-dialog";
import { WorkflowEditor } from "./workflow-editor";
import { WorkflowPreviewModal } from "./workflow-preview-modal";
import type { TemplateOption, WorkflowAnalyticsView, WorkflowDefaultsView, WorkflowView } from "./types";

const PAGE_SIZE = 6;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
type StatusFilter = "ALL" | WorkflowView["status"];

export function WorkflowManager({ workflows, templates, defaults, analytics, profileAiLabelConfirmed = false, initialQuery = "", openCreator = false, initialEditorId = "" }: {
  workflows: WorkflowView[];
  templates: TemplateOption[];
  defaults: WorkflowDefaultsView;
  analytics: WorkflowAnalyticsView[];
  profileAiLabelConfirmed?: boolean;
  initialQuery?: string;
  openCreator?: boolean;
  initialEditorId?: string;
}) {
  const router = useRouter();
  const initialEditor = workflows.find((workflow) => workflow.id === initialEditorId && workflow.status === "DRAFT");
  const [editor, setEditor] = useState<WorkflowView | null | undefined>(openCreator ? null : initialEditor);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkflowView | null>(null);
  const [previewing, setPreviewing] = useState<WorkflowView | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
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
  const commercialSummary = useMemo(() => {
    const published = workflows.filter((workflow) => workflow.status === "PUBLISHED");
    const totals = analytics.reduce((result, item) => ({
      active: result.active + item.active,
      conversions: result.conversions + item.conversions,
      revenueMinor: result.revenueMinor + item.attributedRevenueMinor,
      fans: result.fans + item.uniqueFans,
    }), { active: 0, conversions: 0, revenueMinor: 0, fans: 0 });
    return {
      published: published.length,
      active: totals.active,
      conversions: totals.conversions,
      conversionRate: totals.fans ? totals.conversions / totals.fans * 100 : 0,
      revenueMinor: totals.revenueMinor,
    };
  }, [analytics, workflows]);

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

  async function revise(workflow: WorkflowView) {
    setBusy(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/revise`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "No se pudo crear la nueva versión.");
      enqueueSnackbar(body.reused ? "Ya existía un borrador para esta estrategia." : `Versión ${body.workflow.version} creada como borrador.`, { variant: "success" });
      window.location.assign(`/workflows?edit=${encodeURIComponent(body.workflow.id)}`);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? translateError(error.message) : "No se pudo crear la nueva versión.", { variant: "error" });
      setBusy(false);
    }
  }

  function publish(workflow: WorkflowView) {
    const previous = workflows.find((item) => item.status === "PUBLISHED" && item.stableKey === workflow.stableKey);
    const active = previous?.activeEnrollments ?? 0;
    if (workflow.version > 1 && !window.confirm(`Publicar la versión ${workflow.version} archivará la versión anterior y cancelará ${active} ejecución${active === 1 ? "" : "es"} activa${active === 1 ? "" : "s"}. El historial se conservará. ¿Deseas continuar?`)) return;
    void request(`/api/workflows/${workflow.id}/publish`, { method: "POST" }, `Versión ${workflow.version} publicada correctamente.`);
  }

  if (editor !== undefined) {
    return <section>
      <button type="button" onClick={() => setEditor(undefined)} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-white"><ChevronLeft className="size-4" />Volver a mis workflows</button>
      <WorkflowEditor key={editor?.id ?? "new"} value={editor} defaults={defaults} templates={templates} publishedWorkflows={workflows.filter((workflow) => workflow.status === "PUBLISHED" && workflow.isPrimary)} profileAiLabelConfirmed={profileAiLabelConfirmed} busy={busy} onClose={() => setEditor(undefined)} onSave={save} />
    </section>;
  }

  const statusCounts = {
    ALL: workflows.length,
    DRAFT: workflows.filter((workflow) => workflow.status === "DRAFT").length,
    PUBLISHED: workflows.filter((workflow) => workflow.status === "PUBLISHED").length,
    ARCHIVED: workflows.filter((workflow) => workflow.status === "ARCHIVED").length,
  };
  const publishedWithoutLimits = workflows.filter((workflow) => workflow.status === "PUBLISHED" && !workflow.sendLimitsEnabled);

  return <section>
    {publishedWithoutLimits.length ? <div role="status" className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] px-4 py-3 text-xs leading-5 text-amber-100/80"><p className="font-semibold text-amber-200">Auditoría: {publishedWithoutLimits.length} flujo{publishedWithoutLimits.length === 1 ? " publicado sin tope propio" : "s publicados sin tope propio"}</p><p className="mt-1">{publishedWithoutLimits.map((workflow) => workflow.name).join(", ")}. Sus versiones no se alteraron, pero el límite global obligatorio ahora protege sus envíos. Revísalos antes de campañas grandes; el tope no autoriza mensajes no solicitados.</p></div> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StrategyMetric icon={Rocket} label="Estrategias activas" value={String(commercialSummary.published)} detail={`${commercialSummary.active} fans en curso`} tone="violet" />
      <StrategyMetric icon={Target} label="Conversiones" value={String(commercialSummary.conversions)} detail={`${commercialSummary.conversionRate.toFixed(1)}% global`} tone="cyan" />
      <StrategyMetric icon={DollarSign} label="Ingresos atribuidos" value={money.format(commercialSummary.revenueMinor / 100)} detail="Generados por workflows" tone="emerald" />
      <StrategyMetric icon={TrendingUp} label="Próxima prioridad" value={workflows.find((workflow) => workflow.status === "DRAFT") ? "Publicar borrador" : "Crear estrategia"} detail={workflows.find((workflow) => workflow.status === "DRAFT")?.name ?? "No tienes borradores pendientes"} tone="fuchsia" />
    </div>

    <div className="mt-4 rounded-3xl border border-white/8 bg-white/[.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Portafolio de estrategias</p><h2 className="mt-1 text-lg font-semibold text-white">Mis workflows</h2><p className="mt-1 text-xs text-zinc-500">Encuentra rápido qué convierte, qué está activo y qué necesita atención.</p></div>
        <button onClick={() => setEditor(null)} className="flex items-center gap-2 rounded-xl border border-violet-300/30 bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,.22)] transition hover:bg-violet-400"><Plus className="size-4" />Crear estrategia</button>
      </div>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 focus-within:border-violet-400/40"><Search className="size-4 text-zinc-600" /><span className="sr-only">Buscar workflows</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por nombre, disparador o paso…" className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />{query ? <button type="button" onClick={() => { setQuery(""); setPage(1); }} aria-label="Limpiar búsqueda" className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-white"><X className="size-4" /></button> : null}</label>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-black/15 p-1">{(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((item) => <button key={item} type="button" onClick={() => { setStatus(item); setPage(1); }} className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${status === item ? "bg-violet-500 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}>{statusLabel(item)} <span className="ml-1 opacity-60">{statusCounts[item]}</span></button>)}</div>
      </div>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-2">{visible.map((workflow) => {
      const result = analyticsByWorkflow.get(workflow.id);
      const priority = priorityPresentation(workflow.priority);
      return <article key={workflow.id} className="group relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(145deg,#181a22,#13151b)] transition duration-300 hover:-translate-y-0.5 hover:border-violet-400/25 hover:shadow-[0_18px_50px_rgba(0,0,0,.25),0_0_30px_rgba(124,58,237,.07)]">
        <div aria-hidden className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/0 to-transparent transition group-hover:via-violet-300/70" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Status status={workflow.status} />{workflow.isPrimary ? <span className="rounded-full border border-violet-400/20 bg-violet-400/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-violet-300">Principal</span> : null}<span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${priority.className}`}>{priority.label}</span></div><h3 className="mt-3 truncate text-lg font-semibold text-white">{workflow.name}</h3><p className="mt-1 text-[11px] text-zinc-600">Versión {workflow.version} · prioridad {workflow.priority}</p></div>
            <div className="flex shrink-0 gap-1">{workflow.status === "DRAFT" ? <button onClick={() => setEditor(workflow)} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label={`Editar ${workflow.name}`}><Edit3 className="size-4" /></button> : workflow.status === "PUBLISHED" ? <button disabled={busy} onClick={() => void revise(workflow)} className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/[.06] px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-400/10 disabled:opacity-40" aria-label={`Editar nueva versión de ${workflow.name}`}><Edit3 className="size-3.5" />Nueva versión</button> : null}{workflow.status === "DRAFT" || (workflow.status === "PUBLISHED" && workflow.activeEnrollments === 0) ? <button disabled={busy} onClick={() => setPendingDelete(workflow)} className="rounded-lg border border-white/8 p-2 text-zinc-500 hover:bg-red-400/8 hover:text-red-300" aria-label={`Eliminar ${workflow.name}`}><Trash2 className="size-4" /></button> : null}{workflow.status === "DRAFT" ? <button disabled={busy} onClick={() => publish(workflow)} className="flex items-center gap-1.5 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15"><Rocket className="size-3.5" />Publicar</button> : null}</div>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 rounded-2xl border border-white/7 bg-black/15 p-2">
            <StrategyPoint icon={GitBranch} eyebrow="Cuando ocurre" value={workflowTriggerLabels[workflow.triggerEvent]} />
            <span className="grid place-items-center text-violet-400/50">→</span>
            <StrategyPoint icon={Target} eyebrow="Objetivo" value={workflowGoalLabels[workflow.goalType]} align="right" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <QuickFact icon={Layers3} label="Bloques" value={String(workflow.steps.length)} />
            <QuickFact icon={Users} label="Fans" value={String(workflow.enrollments)} />
            <QuickFact icon={BarChart3} label="Conversión" value={result ? `${result.conversionRate.toFixed(1)}%` : "—"} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-zinc-600"><span>{workflowReentryPolicyLabels[workflow.reentryPolicy]}{workflow.reentryPolicy === "AFTER_DELAY" ? ` · ${workflow.reentryDelayDays} días` : ""}</span>{result?.messagesSent ? <span className="flex items-center gap-1"><MessageSquare className="size-3" />{result.messagesSent} mensajes</span> : null}{result?.attributedRevenueMinor ? <span className="font-medium text-emerald-400">{money.format(result.attributedRevenueMinor / 100)} atribuido</span> : null}{workflow.publishedAt ? <span className="ml-auto flex items-center gap-1"><Clock3 className="size-3" />{formatAppDate(workflow.publishedAt)}</span> : null}</div>
        </div>
        <button type="button" onClick={() => setPreviewing(workflow)} className="flex w-full cursor-pointer items-center justify-between border-t border-white/6 px-5 py-3.5 text-left text-xs font-medium text-zinc-400 transition hover:bg-violet-400/[.04] hover:text-violet-200"><span className="flex items-center gap-2"><Sparkles className="size-3.5 text-violet-400" />Explorar estrategia</span><span className="text-violet-400/50">→</span></button>
      </article>;
    })}</div>

    {!visible.length ? <div className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.02] text-center"><div><Bot className="mx-auto mb-3 size-8 text-zinc-700" /><p className="text-sm font-medium text-zinc-300">No encontramos workflows</p><p className="mt-1 text-xs text-zinc-600">Cambia el filtro o limpia la búsqueda.</p></div></div> : null}

    {filtered.length > PAGE_SIZE ? <nav aria-label="Paginación de workflows" className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-4 py-3"><p className="text-xs text-zinc-600">Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}</p><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-25"><ChevronLeft className="size-4" /></button><span className="min-w-16 text-center text-xs text-zinc-500">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-white/8 p-2 text-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight className="size-4" /></button></div></nav> : null}

    <div className="mt-5 rounded-2xl border border-violet-400/12 bg-violet-400/[.025] p-5"><CheckCircle2 className="mb-3 size-6 text-violet-400" /><h2 className="text-sm font-medium text-white">Diseño seguro</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">Cada acción pasa por Validation Guard. Publicar congela esa versión para que los enrollments en curso nunca cambien inesperadamente.</p></div>
    {pendingDelete ? <WorkflowDeleteDialog workflow={pendingDelete} busy={busy} onCancel={() => setPendingDelete(null)} onConfirm={() => { void request(`/api/workflows/${pendingDelete.id}`, { method: "DELETE" }, "Workflow eliminado correctamente.").then(() => setPendingDelete(null)); }} /> : null}
    {previewing ? <WorkflowPreviewModal workflow={previewing} templates={templates} workflows={workflows} onClose={() => setPreviewing(null)} /> : null}
  </section>;
}

function QuickFact({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/6 bg-black/12 p-2.5"><Icon className="size-3.5 text-violet-400/70" /><p className="mt-2 truncate text-xs font-medium text-zinc-300" title={value}>{value}</p><p className="mt-0.5 text-[9px] uppercase tracking-wide text-zinc-700">{label}</p></div>;
}

function StrategyMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof BarChart3; label: string; value: string; detail: string; tone: "violet" | "cyan" | "emerald" | "fuchsia" }) {
  const styles = { violet: "border-violet-400/15 bg-violet-400/[.035] text-violet-300 shadow-violet-500/10", cyan: "border-cyan-400/15 bg-cyan-400/[.03] text-cyan-300 shadow-cyan-500/10", emerald: "border-emerald-400/15 bg-emerald-400/[.03] text-emerald-300 shadow-emerald-500/10", fuchsia: "border-fuchsia-400/15 bg-fuchsia-400/[.03] text-fuchsia-300 shadow-fuchsia-500/10" }[tone];
  return <article className={`rounded-2xl border p-4 shadow-[0_0_24px_var(--tw-shadow-color)] ${styles}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-zinc-600">{label}</p><p className="mt-2 truncate text-xl font-semibold text-white" title={value}>{value}</p><p className="mt-1 truncate text-[10px] text-zinc-600" title={detail}>{detail}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-current/10 bg-current/8"><Icon className="size-4" /></span></div></article>;
}

function StrategyPoint({ icon: Icon, eyebrow, value, align = "left" }: { icon: typeof BarChart3; eyebrow: string; value: string; align?: "left" | "right" }) {
  return <div className={`min-w-0 p-2 ${align === "right" ? "text-right" : ""}`}><p className={`flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.12em] text-zinc-700 ${align === "right" ? "justify-end" : ""}`}><Icon className="size-3 text-violet-400/70" />{eyebrow}</p><p className="mt-1.5 line-clamp-2 text-xs font-medium leading-4 text-zinc-300">{value}</p></div>;
}

function priorityPresentation(priority: number) {
  if (priority >= 700) return { label: "Prioridad alta", className: "border-rose-400/25 bg-rose-400/8 text-rose-300" };
  if (priority >= 300) return { label: "Prioridad media", className: "border-amber-400/25 bg-amber-400/8 text-amber-300" };
  return { label: "Prioridad normal", className: "border-sky-400/20 bg-sky-400/8 text-sky-300" };
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
    WORKFLOW_PPV_TEMPLATE_INVALID: "El PPV necesita una plantilla con precio y al menos una foto o video bloqueado. La vista gratuita es opcional.",
    WORKFLOW_MESSAGE_TEMPLATE_HAS_PRICE: "Enviar mensaje requiere una plantilla sin precio; usa Enviar PPV para contenido de pago.",
  };
  return errors[message] ?? message;
}
