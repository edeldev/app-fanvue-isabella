"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Flag, GitBranch, ImageIcon, MessageCircleQuestion, MessageSquare, Repeat2, Timer, TimerReset, X, Zap } from "lucide-react";
import { stepTypeLabels } from "@/domain/workflows/definition";
import { workflowGoalLabels } from "@/domain/workflows/conversion-goal";
import { workflowReentryPolicyLabels } from "@/domain/workflows/reentry-policy";
import { workflowTriggerLabels } from "@/domain/workflows/triggers";
import { workflowStepContext } from "./step-context";
import type { TemplateOption, WorkflowView } from "./types";

export function WorkflowPreviewModal({ workflow, templates, workflows, onClose }: {
  workflow: WorkflowView;
  templates: TemplateOption[];
  workflows: WorkflowView[];
  onClose: () => void;
}) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", close); };
  }, [onClose]);

  const templateNames = new Map(templates.map((template) => [template.id, template.name]));
  const workflowNames = new Map(workflows.map((item) => [item.id, item.name]));
  const stepNumbers = new Map(workflow.steps.map((step, index) => [String(step.config.stepKey ?? ""), index + 1]));

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Estructura de ${workflow.name}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#12141a] shadow-2xl shadow-black/70">
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6">
          <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-400">Vista real del workflow</p><h2 className="mt-1 truncate text-xl font-semibold text-white">{workflow.name}</h2><p className="mt-1 text-xs text-zinc-500">Versión {workflow.version} · {workflow.status === "PUBLISHED" ? "Publicado" : workflow.status === "DRAFT" ? "Borrador" : "Archivado"} · Prioridad {workflow.priority}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar estructura" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/8 text-zinc-500 transition hover:bg-white/5 hover:text-white"><X className="size-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Disparador" value={workflowTriggerLabels[workflow.triggerEvent]} />
            <Fact label="Reingreso" value={`${workflowReentryPolicyLabels[workflow.reentryPolicy]}${workflow.reentryPolicy === "AFTER_DELAY" ? ` · ${workflow.reentryDelayDays} días` : ""}`} />
            <Fact label="Objetivo" value={workflowGoalLabels[workflow.goalType]} />
            <Fact label="Tipo" value={workflow.isPrimary ? "Flujo principal" : "Flujo secundario"} />
          </div>

          <div className="mx-auto mt-7 max-w-2xl">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-4 py-2 text-xs font-medium text-emerald-300"><Zap className="size-3.5" />{workflowTriggerLabels[workflow.triggerEvent]}</div>
            <Connector />
            {workflow.steps.map((step, index) => {
              const context = workflowStepContext(step, templateNames, workflowNames) ?? stepTypeLabels[step.type];
              const routes = step.type === "CONDITION"
                ? [{ label: "Sí", target: String(step.config.trueTargetKey ?? ""), tone: "green" }, { label: "No", target: String(step.config.falseTargetKey ?? ""), tone: "red" }]
                : step.type === "WAIT_FOR_REPLY"
                  ? [{ label: "Respondió", target: String(step.config.repliedTargetKey ?? ""), tone: "green" }, { label: "No respondió", target: String(step.config.timeoutTargetKey ?? ""), tone: "amber" }]
                  : [];
              const nextTarget = String(step.config.nextTargetKey ?? "");
              return <div key={`${workflow.id}-${String(step.config.stepKey ?? index)}`}>
                <article className={`overflow-hidden rounded-2xl border bg-[#181a21] ${step.type === "CONDITION" ? "border-amber-400/25" : step.type === "WAIT_FOR_REPLY" ? "border-sky-400/25" : step.type === "WAIT_FOR_SILENCE" ? "border-fuchsia-400/25" : step.type === "END" ? "border-emerald-400/25" : "border-white/10"}`}>
                  <div className="flex items-center gap-3 border-b border-white/7 px-4 py-3"><span className="grid size-9 place-items-center rounded-xl bg-white/5 text-violet-300"><StepIcon type={step.type} /></span><span className="grid size-6 place-items-center rounded-full bg-violet-400/10 text-[10px] font-semibold text-violet-300">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{step.name}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">{stepTypeLabels[step.type]}</p></div></div>
                  <div className="px-4 py-3"><p className="text-xs leading-5 text-zinc-400">{context}</p>{routes.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{routes.map((route) => <Route key={route.label} label={route.label} target={stepNumbers.get(route.target)} tone={route.tone} />)}</div> : nextTarget ? <p className="mt-2 text-[10px] text-violet-300/70">Continúa en el paso {stepNumbers.get(nextTarget) ?? "no disponible"}</p> : null}</div>
                </article>
                {index < workflow.steps.length - 1 ? <Connector label={routes.length ? "ramifica según el resultado" : nextTarget ? `continúa al paso ${stepNumbers.get(nextTarget) ?? "—"}` : "siguiente paso"} /> : null}
              </div>;
            })}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/15 p-3"><p className="text-[9px] uppercase tracking-[.14em] text-zinc-700">{label}</p><p className="mt-1.5 text-xs font-medium text-zinc-300">{value}</p></div>;
}

function Connector({ label }: { label?: string }) {
  return <div className="relative mx-auto flex h-11 items-center justify-center"><span className="h-full w-px bg-white/12" />{label ? <span className="absolute rounded-full border border-white/8 bg-[#12141a] px-2 py-0.5 text-[9px] text-zinc-600">{label}</span> : null}</div>;
}

function Route({ label, target, tone }: { label: string; target?: number; tone: string }) {
  const style = tone === "green" ? "border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300" : tone === "amber" ? "border-amber-400/20 bg-amber-400/[.05] text-amber-300" : "border-red-400/20 bg-red-400/[.05] text-red-300";
  return <div className={`rounded-xl border px-3 py-2 text-[11px] ${style}`}><span className="font-medium">{label}</span><span className="ml-1 opacity-60">→ paso {target ?? "sin configurar"}</span></div>;
}

function StepIcon({ type }: { type: WorkflowView["steps"][number]["type"] }) {
  const Icon = type === "SEND_MESSAGE" ? MessageSquare : type === "SEND_PPV" ? ImageIcon : type === "WAIT" ? Timer : type === "WAIT_FOR_REPLY" ? MessageCircleQuestion : type === "WAIT_FOR_SILENCE" ? TimerReset : type === "CONDITION" ? GitBranch : type === "CHANGE_WORKFLOW" ? Repeat2 : Flag;
  return <Icon className="size-4" />;
}
