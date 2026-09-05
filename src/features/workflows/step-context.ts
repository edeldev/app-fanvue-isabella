import type { WorkflowDefinitionInput } from "@/domain/workflows/definition";

type Step = WorkflowDefinitionInput["steps"][number];

const conditionLabels: Record<string, string> = {
  IS_FOLLOWER: "El fan es seguidor",
  IS_SUBSCRIBER: "Tiene suscripción activa",
  HAS_PURCHASED: "Ha realizado una compra",
  IS_TOP_SPENDER: "Está clasificado como VIP",
};

export function workflowStepContext(
  step: Step,
  templateNames: ReadonlyMap<string, string>,
  workflowNames: ReadonlyMap<string, string>,
): string | null {
  if (step.type === "SEND_MESSAGE" || step.type === "SEND_PPV") {
    return step.messageTemplateId
      ? templateNames.get(step.messageTemplateId) ?? "Plantilla no disponible"
      : "Sin plantilla";
  }
  if (step.type === "WAIT") return formatDuration(Number(step.config.durationMinutes));
  if (step.type === "CONDITION") {
    const condition = String(step.config.condition ?? "");
    return conditionLabels[condition] ?? "Condición no configurada";
  }
  if (step.type === "CHANGE_WORKFLOW") {
    const targetId = String(step.config.targetWorkflowId ?? "");
    return workflowNames.get(targetId) ?? "Workflow de destino no disponible";
  }
  return null;
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "Duración no configurada";
  if (minutes % 1_440 === 0) return `${minutes / 1_440} ${minutes === 1_440 ? "día" : "días"}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hora" : "horas"}`;
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
