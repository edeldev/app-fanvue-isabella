"use client";

import { ArrowDown, ArrowUp, Save, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { editableStepTypes, stepTypeLabels, type WorkflowDefinitionInput } from "@/domain/workflows/definition";
import type { TemplateOption, WorkflowView } from "./types";

interface Props {
  value: WorkflowView | null;
  templates: TemplateOption[];
  publishedWorkflows: Pick<WorkflowView, "id" | "name">[];
  busy: boolean;
  onClose: () => void;
  onSave: (value: WorkflowDefinitionInput) => void;
}

const emptyStep = (type: WorkflowDefinitionInput["steps"][number]["type"]) => ({
  name: stepTypeLabels[type], type, messageTemplateId: null,
  config: type === "WAIT" ? { durationMinutes: 60 } : type === "CONDITION" ? { condition: "IS_FOLLOWER" } : {},
});

export function WorkflowEditor({ value, templates, publishedWorkflows, busy, onClose, onSave }: Props) {
  const initial: WorkflowDefinitionInput = value ? {
    name: value.name, priority: value.priority, isPrimary: value.isPrimary, steps: value.steps,
  } : { name: "", priority: 100, isPrimary: true, steps: [emptyStep("END")] };
  const form = initial;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawSteps = JSON.parse(String(formData.get("steps"))) as WorkflowDefinitionInput["steps"];
    onSave({
      name: String(formData.get("name")),
      priority: Number(formData.get("priority")),
      isPrimary: formData.get("isPrimary") === "on",
      steps: rawSteps,
    });
  }

  return <form onSubmit={submit} className="rounded-2xl border border-violet-400/20 bg-[#15171e] p-5 shadow-xl shadow-black/20">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.16em] text-violet-400">{value ? "Editar borrador" : "Nuevo flujo"}</p><h2 className="mt-1 text-xl font-semibold text-white">Define la estrategia</h2></div><button type="button" onClick={onClose} aria-label="Cerrar editor" className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
    <div className="grid gap-4 md:grid-cols-[1fr_140px]"><label className="text-xs text-zinc-500">Nombre<input name="name" required minLength={3} defaultValue={form.name} placeholder="Ej. Seguidores nuevos" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50" /></label><label className="text-xs text-zinc-500">Prioridad<input name="priority" type="number" min={0} max={1000} defaultValue={form.priority} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50" /></label></div>
    <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input name="isPrimary" type="checkbox" defaultChecked={form.isPrimary} className="size-4 accent-violet-500" />Flujo principal (máximo uno activo por fan)</label>
    <StepList initialSteps={form.steps} templates={templates} publishedWorkflows={publishedWorkflows} />
    <div className="mt-5 flex justify-end"><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"><Save className="size-4" />{busy ? "Guardando…" : "Guardar borrador"}</button></div>
  </form>;
}

function StepList({ initialSteps, templates, publishedWorkflows }: { initialSteps: WorkflowDefinitionInput["steps"]; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[] }) {
  const [steps, setSteps] = useState(initialSteps);
  const update = (index: number, patch: Partial<(typeof steps)[number]>) => setSteps((current) => current.map((step, position) => position === index ? { ...step, ...patch } : step));
  const move = (index: number, offset: number) => setSteps((current) => { const next = [...current]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });

  return <div className="mt-6"><input type="hidden" name="steps" value={JSON.stringify(steps)} /><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-medium text-white">Pasos</h3><p className="mt-0.5 text-xs text-zinc-600">Se ejecutan en este orden y siempre se validan antes de actuar.</p></div><select aria-label="Agregar paso" value="" onChange={(event) => { if (event.target.value) setSteps((current) => [...current.filter((step) => step.type !== "END"), emptyStep(event.target.value as (typeof editableStepTypes)[number]), ...current.filter((step) => step.type === "END")]); }} className="rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="">+ Agregar paso</option>{editableStepTypes.filter((type) => type !== "END").map((type) => <option key={type} value={type}>{stepTypeLabels[type]}</option>)}</select></div>
    <div className="space-y-3">{steps.map((step, index) => <div key={`${index}-${step.type}`} className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-400/10 text-xs font-semibold text-violet-300">{index + 1}</span><input value={step.name} onChange={(event) => update(index, { name: event.target.value })} aria-label={`Nombre del paso ${index + 1}`} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-200 outline-none" /><span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-zinc-500">{stepTypeLabels[step.type]}</span><button type="button" disabled={index === 0 || step.type === "END"} onClick={() => move(index, -1)} className="text-zinc-600 hover:text-white disabled:opacity-20"><ArrowUp className="size-4" /></button><button type="button" disabled={index >= steps.length - 2 || step.type === "END"} onClick={() => move(index, 1)} className="text-zinc-600 hover:text-white disabled:opacity-20"><ArrowDown className="size-4" /></button><button type="button" disabled={step.type === "END"} onClick={() => setSteps((current) => current.filter((_, position) => position !== index))} className="text-zinc-600 hover:text-red-300 disabled:opacity-20"><Trash2 className="size-4" /></button></div><StepConfig step={step} templates={templates} publishedWorkflows={publishedWorkflows} onChange={(patch) => update(index, patch)} /></div>)}</div>
  </div>;
}

function StepConfig({ step, templates, publishedWorkflows, onChange }: { step: WorkflowDefinitionInput["steps"][number]; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[]; onChange: (patch: Partial<typeof step>) => void }) {
  if (step.type === "SEND_MESSAGE" || step.type === "SEND_PPV") return <select value={step.messageTemplateId ?? ""} onChange={(event) => onChange({ messageTemplateId: event.target.value || null })} className="mt-3 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="">Selecciona una plantilla</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.type}</option>)}</select>;
  if (step.type === "WAIT") return <label className="mt-3 block text-xs text-zinc-500">Minutos de espera<input type="number" min={1} max={43200} value={Number(step.config.durationMinutes ?? 60)} onChange={(event) => onChange({ config: { durationMinutes: Number(event.target.value) } })} className="ml-3 w-28 rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-zinc-200" /></label>;
  if (step.type === "CONDITION") return <select value={String(step.config.condition ?? "IS_FOLLOWER")} onChange={(event) => onChange({ config: { condition: event.target.value } })} className="mt-3 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="IS_FOLLOWER">Es seguidor</option><option value="IS_SUBSCRIBER">Tiene suscripción activa</option><option value="HAS_PURCHASED">Ha realizado una compra</option><option value="IS_TOP_SPENDER">Es VIP</option></select>;
  if (step.type === "CHANGE_WORKFLOW") return <select value={String(step.config.targetWorkflowId ?? "")} onChange={(event) => onChange({ config: { targetWorkflowId: event.target.value } })} className="mt-3 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="">Selecciona un flujo publicado</option>{publishedWorkflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select>;
  return <p className="mt-2 text-xs text-zinc-600">Cierra el enrollment y registra el resultado del flujo.</p>;
}
