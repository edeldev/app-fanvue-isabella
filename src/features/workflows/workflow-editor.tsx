"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Flag, GitBranch, GripVertical, ImageIcon, MessageSquare, Repeat2, Save, Timer, Trash2, X, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { editableStepTypes, stepTypeLabels, type WorkflowDefinitionInput } from "@/domain/workflows/definition";
import type { TemplateOption, WorkflowDefaultsView, WorkflowView } from "./types";
import { workflowTriggerLabels, workflowTriggers } from "@/domain/workflows/triggers";
import { workflowConditionLabels, workflowConditions, type WorkflowCondition, type WorkflowConditionOperator, type WorkflowConditionRule } from "@/domain/workflows/evaluate-condition";
import { workflowReentryPolicies, workflowReentryPolicyLabels, type WorkflowReentryPolicy } from "@/domain/workflows/reentry-policy";
import { workflowGoalLabels, workflowGoalTypes, type WorkflowGoalType } from "@/domain/workflows/conversion-goal";
import { clearBackwardWorkflowConnections, reorderWorkflowSteps } from "@/domain/workflows/visual-builder";

interface Props {
  value: WorkflowView | null;
  defaults: WorkflowDefaultsView;
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

const weekDays = [{ value: 1, label: "L" }, { value: 2, label: "M" }, { value: 3, label: "X" }, { value: 4, label: "J" }, { value: 5, label: "V" }, { value: 6, label: "S" }, { value: 0, label: "D" }];
const timeZones = ["America/Monterrey", "America/Mexico_City", "America/Tijuana", "America/Cancun", "America/New_York", "America/Los_Angeles", "UTC"];
const minuteToTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const timeToMinute = (time: FormDataEntryValue | null) => { const [hour, minute] = String(time).split(":").map(Number); return hour * 60 + minute; };

function normalizeStepKeys(steps: WorkflowDefinitionInput["steps"]) {
  return steps.map((step, index) => ({
    ...step,
    config: { ...step.config, stepKey: typeof step.config.stepKey === "string" ? step.config.stepKey : `step-${index}-${step.type.toLowerCase()}` },
  }));
}

function newStep(type: WorkflowDefinitionInput["steps"][number]["type"]) {
  const step = emptyStep(type);
  return { ...step, config: { ...step.config, stepKey: crypto.randomUUID() } };
}

export function WorkflowEditor({ value, defaults, templates, publishedWorkflows, busy, onClose, onSave }: Props) {
  const initial: WorkflowDefinitionInput = value ? {
    name: value.name, priority: value.priority, isPrimary: value.isPrimary, triggerEvent: value.triggerEvent, reentryPolicy: value.reentryPolicy, reentryDelayDays: value.reentryDelayDays, sendWindowEnabled: value.sendWindowEnabled, sendWindowTimezone: value.sendWindowTimezone, sendWindowStartMinute: value.sendWindowStartMinute, sendWindowEndMinute: value.sendWindowEndMinute, sendWindowDays: value.sendWindowDays, sendLimitsEnabled: value.sendLimitsEnabled, maxMessagesPerHour: value.maxMessagesPerHour, maxMessagesPerDay: value.maxMessagesPerDay, minMinutesBetweenFanMessages: value.minMinutesBetweenFanMessages, pauseOnFanReply: value.pauseOnFanReply, replySilenceMinutes: value.replySilenceMinutes, replyAttributionHours: value.replyAttributionHours, goalType: value.goalType, goalAmountMinor: value.goalAmountMinor, steps: normalizeStepKeys(value.steps),
  } : { name: "", priority: 100, isPrimary: true, triggerEvent: "MANUAL", reentryPolicy: "ONCE" as const, reentryDelayDays: null, ...defaults, pauseOnFanReply: false, replySilenceMinutes: 60, replyAttributionHours: 24, goalType: "NONE" as const, goalAmountMinor: null, steps: normalizeStepKeys([emptyStep("END")]) };
  const form = initial;
  const [reentryPolicy, setReentryPolicy] = useState<WorkflowReentryPolicy>(form.reentryPolicy);
  const [sendWindowEnabled, setSendWindowEnabled] = useState(form.sendWindowEnabled);
  const [sendWindowDays, setSendWindowDays] = useState(form.sendWindowDays);
  const [sendLimitsEnabled, setSendLimitsEnabled] = useState(form.sendLimitsEnabled);
  const [pauseOnFanReply, setPauseOnFanReply] = useState(form.pauseOnFanReply);
  const [goalType, setGoalType] = useState<WorkflowGoalType>(form.goalType);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawSteps = JSON.parse(String(formData.get("steps"))) as WorkflowDefinitionInput["steps"];
    onSave({
      name: String(formData.get("name")),
      priority: Number(formData.get("priority")),
      isPrimary: formData.get("isPrimary") === "on",
      triggerEvent: String(formData.get("triggerEvent")) as WorkflowDefinitionInput["triggerEvent"],
      reentryPolicy,
      reentryDelayDays: reentryPolicy === "AFTER_DELAY" ? Number(formData.get("reentryDelayDays")) : null,
      sendWindowEnabled,
      sendWindowTimezone: String(formData.get("sendWindowTimezone")),
      sendWindowStartMinute: timeToMinute(formData.get("sendWindowStart")),
      sendWindowEndMinute: timeToMinute(formData.get("sendWindowEnd")),
      sendWindowDays,
      sendLimitsEnabled,
      maxMessagesPerHour: Number(formData.get("maxMessagesPerHour")),
      maxMessagesPerDay: Number(formData.get("maxMessagesPerDay")),
      minMinutesBetweenFanMessages: Number(formData.get("minMinutesBetweenFanMessages")),
      pauseOnFanReply,
      replySilenceMinutes: Number(formData.get("replySilenceMinutes")),
      replyAttributionHours: Number(formData.get("replyAttributionHours")),
      goalType,
      goalAmountMinor: goalType === "SPEND_AMOUNT" ? Math.round(Number(formData.get("goalAmount")) * 100) : null,
      steps: rawSteps,
    });
  }

  return <form data-workflow-editor onSubmit={submit} className="min-w-0 overflow-hidden rounded-2xl border border-violet-400/20 bg-[#15171e] p-5 shadow-xl shadow-black/20">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.16em] text-violet-400">{value ? "Editar borrador" : "Nuevo flujo"}</p><h2 className="mt-1 text-xl font-semibold text-white">Define la estrategia</h2></div><button type="button" onClick={onClose} aria-label="Cerrar editor" className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
    <div className="grid gap-4 md:grid-cols-[1fr_140px]"><label className="text-xs text-zinc-500">Nombre<input name="name" required minLength={3} defaultValue={form.name} placeholder="Ej. Seguidores nuevos" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50" /></label><label className="text-xs text-zinc-500">Prioridad<input name="priority" type="number" min={0} max={1000} defaultValue={form.priority} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50" /></label></div>
    <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input name="isPrimary" type="checkbox" defaultChecked={form.isPrimary} className="size-4 accent-violet-500" />Flujo principal (máximo uno activo por fan)</label>
    <label className="mt-4 block text-xs text-zinc-500">Cómo inicia este workflow<select name="triggerEvent" defaultValue={form.triggerEvent} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-violet-400/50">{workflowTriggers.map((trigger) => <option key={trigger} value={trigger}>{workflowTriggerLabels[trigger]}</option>)}</select><span className="mt-1.5 block text-[11px] text-zinc-600">Los disparadores automáticos solo funcionan después de publicar el workflow.</span></label>
    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]"><label className="text-xs text-zinc-500">Reingreso del fan<select name="reentryPolicy" value={reentryPolicy} onChange={(event) => setReentryPolicy(event.target.value as WorkflowReentryPolicy)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-violet-400/50">{workflowReentryPolicies.map((policy) => <option key={policy} value={policy}>{workflowReentryPolicyLabels[policy]}</option>)}</select></label>{reentryPolicy === "AFTER_DELAY" ? <label className="text-xs text-zinc-500">Días<input name="reentryDelayDays" type="number" required min={1} max={365} defaultValue={form.reentryDelayDays ?? 7} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/50" /></label> : null}</div>
    <p className="mt-1.5 text-[11px] text-zinc-600">Nunca se crea otra ejecución del mismo workflow mientras el fan ya tenga una activa.</p>
    <details className="group mt-5 overflow-hidden rounded-2xl border border-white/8 bg-black/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[.025] [&::-webkit-details-marker]:hidden"><span>Configuración avanzada <span className="ml-2 text-xs font-normal text-zinc-600">Horarios, límites, respuestas y conversión</span></span><span className="text-xs text-violet-400 group-open:hidden">Abrir ↓</span><span className="hidden text-xs text-violet-400 group-open:block">Cerrar ↑</span></summary>
      <div className="border-t border-white/8 p-4">
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-violet-400/15 bg-violet-400/[.035] px-4 py-3 sm:flex-row sm:items-center">
      <div><p className="text-xs font-medium text-violet-200">{value ? "Configuración propia de este workflow" : "Valores tomados de Configuración global"}</p><p className="mt-1 text-[11px] leading-4 text-zinc-500">{value ? "Los cambios siguientes solo afectarán este borrador. Las versiones publicadas permanecen intactas." : "Puedes personalizarlos aquí sin modificar los demás workflows."}</p></div>
      <Link href="/settings" className="shrink-0 text-[11px] font-medium text-violet-300 hover:text-violet-200">Editar valores globales →</Link>
    </div>
    <section className="mt-4 rounded-xl border border-white/8 bg-black/15 p-4"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={sendWindowEnabled} onChange={(event) => setSendWindowEnabled(event.target.checked)} className="size-4 accent-violet-500" />Limitar horario de envío</label><p className="mt-1 text-[11px] text-zinc-600">Las esperas y condiciones avanzan normalmente; solo los mensajes se aplazan fuera del horario.</p><div className={`mt-3 grid gap-3 sm:grid-cols-3 ${sendWindowEnabled ? "" : "pointer-events-none opacity-40"}`}><label className="text-xs text-zinc-500">Desde<input name="sendWindowStart" type="time" required defaultValue={minuteToTime(form.sendWindowStartMinute)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label><label className="text-xs text-zinc-500">Hasta<input name="sendWindowEnd" type="time" required defaultValue={minuteToTime(form.sendWindowEndMinute)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label><label className="text-xs text-zinc-500">Zona horaria<select name="sendWindowTimezone" defaultValue={form.sendWindowTimezone} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200">{timeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label></div><div className={`mt-3 flex flex-wrap gap-2 ${sendWindowEnabled ? "" : "pointer-events-none opacity-40"}`}>{weekDays.map((day) => { const selected = sendWindowDays.includes(day.value); return <button key={day.value} type="button" aria-pressed={selected} onClick={() => setSendWindowDays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value])} className={`grid size-9 place-items-center rounded-lg border text-xs ${selected ? "border-violet-400/40 bg-violet-500 text-white" : "border-white/10 text-zinc-500"}`}>{day.label}</button>; })}</div>{sendWindowEnabled && sendWindowDays.length === 0 ? <p className="mt-2 text-xs text-red-300">Selecciona al menos un día.</p> : null}</section>
    <section className="mt-4 rounded-xl border border-white/8 bg-black/15 p-4"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={sendLimitsEnabled} onChange={(event) => setSendLimitsEnabled(event.target.checked)} className="size-4 accent-violet-500" />Activar límites de seguridad</label><p className="mt-1 text-[11px] text-zinc-600">Al alcanzar un límite, el mensaje espera automáticamente; nunca se descarta.</p><div className={`mt-3 grid gap-3 sm:grid-cols-3 ${sendLimitsEnabled ? "" : "pointer-events-none opacity-40"}`}><label className="text-xs text-zinc-500">Máximo por hora<input name="maxMessagesPerHour" type="number" required min={1} max={1000} defaultValue={form.maxMessagesPerHour} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label><label className="text-xs text-zinc-500">Máximo por 24 horas<input name="maxMessagesPerDay" type="number" required min={1} max={10000} defaultValue={form.maxMessagesPerDay} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label><label className="text-xs text-zinc-500">Minutos entre mensajes al mismo fan<input name="minMinutesBetweenFanMessages" type="number" required min={0} max={43200} defaultValue={form.minMinutesBetweenFanMessages} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label></div></section>
    <section className="mt-4 rounded-xl border border-white/8 bg-black/15 p-4"><label className="flex items-start gap-3"><input type="checkbox" checked={pauseOnFanReply} onChange={(event) => setPauseOnFanReply(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-violet-500" /><span><span className="block text-sm text-zinc-300">Pausar cuando el fan responda</span><span className="mt-1 block text-[11px] leading-5 text-zinc-600">Cada respuesta reinicia el tiempo de silencio. Después, el workflow continúa donde se quedó.</span></span></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`block text-xs text-zinc-500 ${pauseOnFanReply ? "" : "pointer-events-none opacity-40"}`}>Reanudar después de minutos sin respuesta<input name="replySilenceMinutes" type="number" required min={1} max={43200} defaultValue={form.replySilenceMinutes} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label><label className="block text-xs text-zinc-500">Contar respuestas después de finalizar (horas)<input name="replyAttributionHours" type="number" required min={1} max={720} defaultValue={form.replyAttributionHours} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /><span className="mt-1.5 block text-[11px] leading-4 text-zinc-600">Se mide desde el último mensaje automático. Recomendado: 24 horas.</span></label></div></section>
    <section className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[.03] p-4"><p className="text-sm text-zinc-300">Objetivo de conversión</p><p className="mt-1 text-[11px] leading-5 text-zinc-600">Cuando el fan cumpla este objetivo, el workflow termina y ya no envía los mensajes restantes.</p><div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]"><label className="text-xs text-zinc-500">Objetivo<select value={goalType} onChange={(event) => setGoalType(event.target.value as WorkflowGoalType)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200">{workflowGoalTypes.map((goal) => <option key={goal} value={goal}>{workflowGoalLabels[goal]}</option>)}</select></label>{goalType === "SPEND_AMOUNT" ? <label className="text-xs text-zinc-500">Cantidad en USD<input name="goalAmount" type="number" required min="0.01" step="0.01" defaultValue={(form.goalAmountMinor ?? 5_000) / 100} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#20222b] px-3 py-2 text-zinc-200" /></label> : null}</div></section>
      </div>
    </details>
    <StepList initialSteps={form.steps} templates={templates} publishedWorkflows={publishedWorkflows} />
    <div className="mt-5 flex justify-end"><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"><Save className="size-4" />{busy ? "Guardando…" : "Guardar borrador"}</button></div>
  </form>;
}

function StepList({ initialSteps, templates, publishedWorkflows }: { initialSteps: WorkflowDefinitionInput["steps"]; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[] }) {
  const [steps, setSteps] = useState(initialSteps);
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const update = (index: number, patch: Partial<(typeof steps)[number]>) => setSteps((current) => current.map((step, position) => position === index ? { ...step, ...patch } : step));
  const move = (index: number, offset: number) => setSteps((current) => reorderWorkflowSteps(current, index, index + offset));
  const addStep = (type: (typeof editableStepTypes)[number], at?: number) => setSteps((current) => {
    const next = [...current];
    const endIndex = next.findIndex((step) => step.type === "END");
    next.splice(Math.min(at ?? endIndex, endIndex), 0, newStep(type));
    return next;
  });
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);
    if (!over) {
      setDragging(null);
      return;
    }
    const overId = String(over.id);
    const targetIndex = steps.findIndex((step) => String(step.config.stepKey) === overId);
    if (targetIndex < 0) {
      setDragging(null);
      return;
    }
    if (activeId.startsWith("palette:")) {
      addStep(activeId.slice(8) as (typeof editableStepTypes)[number], targetIndex);
    } else {
      const fromIndex = steps.findIndex((step) => String(step.config.stepKey) === activeId);
      if (fromIndex >= 0 && fromIndex !== targetIndex) setSteps((current) => reorderWorkflowSteps(current, fromIndex, targetIndex));
    }
    setDragging(null);
  };
  const stepIds = steps.map((step) => String(step.config.stepKey));
  const draggingType = dragging?.startsWith("palette:") ? dragging.slice(8) as (typeof editableStepTypes)[number] : steps.find((step) => String(step.config.stepKey) === dragging)?.type;

  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setDragging(String(active.id))} onDragCancel={() => setDragging(null)} onDragEnd={handleDragEnd}><section className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-[#101218]"><input type="hidden" name="steps" value={JSON.stringify(steps)} />
    <div className="border-b border-white/8 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-white">Diagrama del flujo</h3><p className="mt-1 text-xs text-zinc-600">Arrastra un bloque al lienzo o toma el asa de un paso para cambiar su orden.</p></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-zinc-500">{steps.length} bloques</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{editableStepTypes.filter((type) => type !== "END").map((type) => <PaletteBlock key={type} type={type} onClick={() => addStep(type)} />)}</div>
    </div>
    <div className="relative mx-auto max-w-3xl px-3 py-5 sm:px-6">
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-4 py-2 text-xs font-medium text-emerald-300"><Zap className="size-3.5" />Inicio</div>
      <DropConnector active={dragging !== null} />
      <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>{steps.map((step, index) => <SortableStepCard key={String(step.config.stepKey)} step={step} index={index} steps={steps} dragging={dragging} templates={templates} publishedWorkflows={publishedWorkflows} update={update} move={move} remove={() => setSteps((current) => clearBackwardWorkflowConnections(current.filter((_, position) => position !== index)))} />)}</SortableContext>
    </div>
  </section><DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>{draggingType ? <div className="flex items-center gap-2 rounded-xl border border-violet-400/50 bg-[#20222b] px-4 py-3 text-sm font-medium text-white shadow-2xl shadow-black/60"><GripVertical className="size-4 text-violet-300" /><StepIcon type={draggingType} />{stepTypeLabels[draggingType]}</div> : null}</DragOverlay></DndContext>;
}

function PaletteBlock({ type, onClick }: { type: (typeof editableStepTypes)[number]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
  return <button ref={setNodeRef} {...attributes} {...listeners} type="button" onClick={() => { if (!isDragging) onClick(); }} className={`group flex touch-none cursor-grab items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] px-3 py-2.5 text-left text-[11px] text-zinc-400 transition hover:border-violet-400/30 hover:bg-violet-400/8 hover:text-white active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}><StepIcon type={type} /><span>{stepTypeLabels[type]}</span></button>;
}

function stepDetail(step: WorkflowDefinitionInput["steps"][number], templates: TemplateOption[], publishedWorkflows: Pick<WorkflowView, "id" | "name">[] = []) {
  if (step.type === "SEND_MESSAGE" || step.type === "SEND_PPV") return step.messageTemplateId ? templates.find((item) => item.id === step.messageTemplateId)?.name ?? "Plantilla no disponible" : "Sin plantilla";
  if (step.type === "WAIT") return `${Number(step.config.durationMinutes ?? 60)} min de espera`;
  if (step.type === "CONDITION") {
    const conditions = Array.isArray(step.config.conditions) ? step.config.conditions : [];
    if (conditions.length > 1) return `${conditions.length} condiciones · ${step.config.conditionOperator === "ANY" ? "Cualquiera (O)" : "Todas (Y)"}`;
    const condition = String(conditions[0] && typeof conditions[0] === "object" && "condition" in conditions[0] ? conditions[0].condition : step.config.condition ?? "IS_FOLLOWER") as WorkflowCondition;
    return workflowConditionLabels[condition] ?? "Condición sin configurar";
  }
  if (step.type === "CHANGE_WORKFLOW") return publishedWorkflows.find((workflow) => workflow.id === String(step.config.targetWorkflowId ?? ""))?.name ?? "Flujo sin seleccionar";
  return "Termina el workflow";
}

function SortableStepCard({ step, index, steps, dragging, templates, publishedWorkflows, update, move, remove }: { step: WorkflowDefinitionInput["steps"][number]; index: number; steps: WorkflowDefinitionInput["steps"]; dragging: string | null; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[]; update: (index: number, patch: Partial<WorkflowDefinitionInput["steps"][number]>) => void; move: (index: number, offset: number) => void; remove: () => void }) {
  const id = String(step.config.stepKey);
  const detail = stepDetail(step, templates, publishedWorkflows);
  const routes = steps.flatMap((candidate, sourceIndex) => candidate.type !== "CONDITION" ? [] : [
    ...(String(candidate.config.trueTargetKey ?? "") === id ? [{ kind: "true" as const, sourceIndex }] : []),
    ...(String(candidate.config.falseTargetKey ?? "") === id ? [{ kind: "false" as const, sourceIndex }] : []),
  ]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id, disabled: { draggable: step.type === "END" } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="relative z-10">
    {routes.length ? <div className="mb-2 flex flex-wrap justify-center gap-2">{routes.map((route) => <span key={`${route.kind}-${route.sourceIndex}`} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${route.kind === "true" ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-300" : "border-red-400/25 bg-red-400/8 text-red-300"}`}>{route.kind === "true" ? "✓ Ruta: Sí cumple" : "× Ruta: No cumple"} · desde paso {route.sourceIndex + 1}</span>)}</div> : null}
    <article className={`relative rounded-2xl border bg-[#181a21] shadow-lg shadow-black/15 transition-colors ${isDragging ? "border-violet-400/50 opacity-35" : isOver && dragging ? "border-violet-400/60 ring-2 ring-violet-400/15" : step.type === "CONDITION" ? "border-amber-400/20" : step.type === "END" ? "border-emerald-400/20" : "border-white/10"}`}>
      <div className="flex items-center gap-3 border-b border-white/7 px-3 py-3 sm:px-4">
        {step.type !== "END" ? <button type="button" {...attributes} {...listeners} aria-label={`Arrastrar paso ${index + 1}`} title="Arrastra para cambiar la posición" className="touch-none cursor-grab rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-zinc-300 active:cursor-grabbing"><GripVertical className="size-4" /></button> : <span className="w-7" />}
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/5 text-violet-300"><StepIcon type={step.type} /></span>
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-400/10 text-[10px] font-semibold text-violet-300">{index + 1}</span>
        <input value={step.name} onChange={(event) => update(index, { name: event.target.value })} aria-label={`Nombre del paso ${index + 1}`} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none focus:text-white" />
        <span title={`${stepTypeLabels[step.type]} · ${detail}`} className="hidden max-w-56 truncate rounded-md bg-white/5 px-2 py-1 text-[10px] text-zinc-400 sm:block">{stepTypeLabels[step.type]} · {detail}</span>
        <button type="button" disabled={index === 0 || step.type === "END"} onClick={() => move(index, -1)} aria-label="Mover arriba" className="rounded-md p-1 text-zinc-600 hover:bg-white/5 hover:text-white disabled:opacity-20"><ArrowUp className="size-4" /></button>
        <button type="button" disabled={index >= steps.length - 2 || step.type === "END"} onClick={() => move(index, 1)} aria-label="Mover abajo" className="rounded-md p-1 text-zinc-600 hover:bg-white/5 hover:text-white disabled:opacity-20"><ArrowDown className="size-4" /></button>
        <button type="button" disabled={step.type === "END"} onClick={remove} aria-label="Eliminar paso" className="rounded-md p-1 text-zinc-600 hover:bg-red-400/8 hover:text-red-300 disabled:opacity-20"><Trash2 className="size-4" /></button>
      </div>
      <div className="p-3 sm:p-4"><div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500 sm:hidden"><span className="rounded-md bg-white/5 px-2 py-1">{stepTypeLabels[step.type]}</span><span className="min-w-0 truncate">{detail}</span></div><StepConfig step={step} stepIndex={index} steps={steps} templates={templates} publishedWorkflows={publishedWorkflows} onChange={(patch) => update(index, patch)} />{step.type !== "CONDITION" && step.type !== "END" ? <NextStepSelect step={step} targets={steps.slice(index + 1)} firstTargetNumber={index + 2} templates={templates} publishedWorkflows={publishedWorkflows} onChange={(value) => update(index, { config: { ...step.config, nextTargetKey: value || undefined } })} /> : null}</div>
    </article>
    {index < steps.length - 1 ? <DropConnector active={dragging !== null} condition={step.type === "CONDITION"} /> : null}
  </div>;
}

function DropConnector({ active, condition = false }: { active: boolean; condition?: boolean }) {
  return <div className="group relative mx-auto flex h-12 w-full max-w-xl items-center justify-center transition"><span className={`h-full w-px ${condition ? "bg-gradient-to-b from-amber-400/50 to-violet-400/40" : "bg-white/12"}`} /><span className={`absolute rounded-full border bg-[#181a21] px-2 py-0.5 text-[9px] transition ${active ? "border-violet-400/30 text-violet-300" : "border-white/8 text-zinc-700"}`}>{active ? "Suelta sobre un bloque" : condition ? "ramifica" : "continúa"}</span></div>;
}

function StepIcon({ type }: { type: WorkflowDefinitionInput["steps"][number]["type"] }) {
  const Icon = type === "SEND_MESSAGE" ? MessageSquare : type === "WAIT" ? Timer : type === "SEND_PPV" ? ImageIcon : type === "CONDITION" ? GitBranch : type === "CHANGE_WORKFLOW" ? Repeat2 : Flag;
  return <Icon className="size-3.5" />;
}

function StepConfig({ step, stepIndex, steps, templates, publishedWorkflows, onChange }: { step: WorkflowDefinitionInput["steps"][number]; stepIndex: number; steps: WorkflowDefinitionInput["steps"]; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[]; onChange: (patch: Partial<typeof step>) => void }) {
  if (step.type === "SEND_MESSAGE" || step.type === "SEND_PPV") { const compatible = templates.filter((template) => step.type === "SEND_PPV" ? Boolean(template.priceMinor && template.previewUuid) : !template.priceMinor); return <select value={step.messageTemplateId ?? ""} onChange={(event) => onChange({ messageTemplateId: event.target.value || null })} className="mt-3 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="">{step.type === "SEND_PPV" ? "Selecciona una plantilla PPV" : "Selecciona una plantilla sin precio"}</option>{compatible.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.type}{template.priceMinor ? ` · $${(template.priceMinor / 100).toFixed(2)}` : ""}</option>)}</select>; }
  if (step.type === "WAIT") return <label className="mt-3 block text-xs text-zinc-500">Minutos de espera<input type="number" min={1} max={43200} value={Number(step.config.durationMinutes ?? 60)} onChange={(event) => onChange({ config: { ...step.config, durationMinutes: Number(event.target.value) } })} className="ml-3 w-28 rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-zinc-200" /></label>;
  if (step.type === "CONDITION") return <ConditionConfig step={step} targets={steps.slice(stepIndex + 1)} firstTargetNumber={stepIndex + 2} templates={templates} publishedWorkflows={publishedWorkflows} onChange={onChange} />;
  if (step.type === "CHANGE_WORKFLOW") return <select value={String(step.config.targetWorkflowId ?? "")} onChange={(event) => onChange({ config: { ...step.config, targetWorkflowId: event.target.value } })} className="mt-3 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="">Selecciona un flujo publicado</option>{publishedWorkflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select>;
  return <p className="mt-2 text-xs text-zinc-600">Cierra el enrollment y registra el resultado del flujo.</p>;
}

function ConditionConfig({ step, targets, firstTargetNumber, templates, publishedWorkflows, onChange }: { step: WorkflowDefinitionInput["steps"][number]; targets: WorkflowDefinitionInput["steps"]; firstTargetNumber: number; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[]; onChange: (patch: Partial<typeof step>) => void }) {
  const rules: WorkflowConditionRule[] = Array.isArray(step.config.conditions)
    ? step.config.conditions.flatMap((value) => typeof value === "object" && value && !Array.isArray(value) && "condition" in value ? [value as WorkflowConditionRule] : [])
    : [{ condition: String(step.config.condition ?? "IS_FOLLOWER") as WorkflowCondition }];
  const operator: WorkflowConditionOperator = step.config.conditionOperator === "ANY" ? "ANY" : "ALL";
  const updateRules = (next: WorkflowConditionRule[]) => onChange({ config: { ...step.config, condition: undefined, conditions: next, conditionOperator: operator } });
  const usesAmount = (condition: WorkflowCondition) => condition === "SPENT_MORE_THAN_50" || condition === "SPENT_LESS_THAN";

  return <div className="mt-3 grid gap-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-zinc-500">El fan debe cumplir:</p><div className="inline-flex rounded-lg border border-white/8 bg-black/20 p-1"><button type="button" onClick={() => onChange({ config: { ...step.config, condition: undefined, conditions: rules, conditionOperator: "ALL" } })} className={`rounded-md px-3 py-1.5 text-[11px] ${operator === "ALL" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>Todas (Y)</button><button type="button" onClick={() => onChange({ config: { ...step.config, condition: undefined, conditions: rules, conditionOperator: "ANY" } })} className={`rounded-md px-3 py-1.5 text-[11px] ${operator === "ANY" ? "bg-violet-500 text-white" : "text-zinc-500"}`}>Cualquiera (O)</button></div></div><div className="space-y-2">{rules.map((rule, index) => <div key={`${index}-${rule.condition}`} className="flex flex-col gap-2 rounded-lg border border-white/8 bg-black/15 p-2 sm:flex-row"><select value={rule.condition} onChange={(event) => { const condition = event.target.value as WorkflowCondition; updateRules(rules.map((item, position) => position === index ? { condition, ...(usesAmount(condition) ? { amountMinor: 5_000 } : {}) } : item)); }} className="min-w-0 flex-1 rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300">{workflowConditions.map((condition) => <option key={condition} value={condition}>{workflowConditionLabels[condition]}</option>)}</select>{usesAmount(rule.condition) ? <label className="flex items-center gap-2 text-xs text-zinc-500">$<input type="number" min={0} step="0.01" value={(rule.amountMinor ?? 5_000) / 100} onChange={(event) => updateRules(rules.map((item, position) => position === index ? { ...item, amountMinor: Math.round(Number(event.target.value) * 100) } : item))} className="w-24 rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-zinc-200" /></label> : null}<button type="button" disabled={rules.length === 1} onClick={() => updateRules(rules.filter((_, position) => position !== index))} aria-label="Eliminar condición" className="rounded-lg p-2 text-zinc-600 hover:text-red-300 disabled:opacity-20"><Trash2 className="size-4" /></button></div>)}</div><button type="button" disabled={rules.length >= 10} onClick={() => updateRules([...rules, { condition: "IS_FOLLOWER" }])} className="w-fit rounded-lg border border-violet-400/20 px-3 py-2 text-xs text-violet-300 hover:bg-violet-400/8 disabled:opacity-40">+ Agregar condición</button><p className="text-[11px] leading-4 text-zinc-600">Elige el bloque exacto para cada ruta. Después aparecerá identificado con una etiqueta verde o roja en el diagrama.</p><div className="grid gap-2 sm:grid-cols-2"><BranchSelect label="Si cumple" value={String(step.config.trueTargetKey ?? "")} targets={targets} firstTargetNumber={firstTargetNumber} templates={templates} publishedWorkflows={publishedWorkflows} onChange={(value) => onChange({ config: { ...step.config, trueTargetKey: value } })} /><BranchSelect label="Si no cumple" value={String(step.config.falseTargetKey ?? "")} targets={targets} firstTargetNumber={firstTargetNumber} templates={templates} publishedWorkflows={publishedWorkflows} onChange={(value) => onChange({ config: { ...step.config, falseTargetKey: value } })} /></div></div>;
}

function targetLabel(target: WorkflowDefinitionInput["steps"][number], number: number, templates: TemplateOption[], publishedWorkflows: Pick<WorkflowView, "id" | "name">[] = []) {
  return `Paso ${number} · ${stepTypeLabels[target.type]} · ${stepDetail(target, templates, publishedWorkflows)}`;
}

function BranchSelect({ label, value, targets, firstTargetNumber, templates, publishedWorkflows, onChange }: { label: string; value: string; targets: WorkflowDefinitionInput["steps"]; firstTargetNumber: number; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[]; onChange: (value: string) => void }) {
  const positive = label === "Si cumple";
  const selectedIndex = targets.findIndex((target) => String(target.config.stepKey) === value);
  return <label className={`rounded-xl border p-3 text-[11px] ${positive ? "border-emerald-400/20 bg-emerald-400/[.045] text-emerald-300" : "border-red-400/20 bg-red-400/[.035] text-red-300"}`}><span className="flex items-center gap-2 font-medium"><span className={`grid size-5 place-items-center rounded-full ${positive ? "bg-emerald-400/15" : "bg-red-400/15"}`}>{positive ? "✓" : "×"}</span>{label}</span><select value={value} required onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-300"><option value="">Selecciona el bloque de esta ruta</option>{targets.map((target, index) => <option key={String(target.config.stepKey)} value={String(target.config.stepKey)}>{targetLabel(target, firstTargetNumber + index, templates, publishedWorkflows)}</option>)}</select>{selectedIndex >= 0 ? <span className="mt-2 block leading-4 text-zinc-500">Esta ruta irá al {targetLabel(targets[selectedIndex], firstTargetNumber + selectedIndex, templates, publishedWorkflows)}.</span> : null}</label>;
}

function NextStepSelect({ step, targets, firstTargetNumber, templates, publishedWorkflows, onChange }: { step: WorkflowDefinitionInput["steps"][number]; targets: WorkflowDefinitionInput["steps"]; firstTargetNumber: number; templates: TemplateOption[]; publishedWorkflows: Pick<WorkflowView, "id" | "name">[]; onChange: (value: string) => void }) {
  return <label className="mt-3 block text-[11px] text-zinc-600">Después continuar en <select value={String(step.config.nextTargetKey ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/8 bg-[#20222b] px-3 py-2 text-xs text-zinc-400"><option value="">Siguiente paso en orden</option>{targets.map((target, index) => <option key={String(target.config.stepKey)} value={String(target.config.stepKey)}>{targetLabel(target, firstTargetNumber + index, templates, publishedWorkflows)}</option>)}</select></label>;
}
