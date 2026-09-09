import type { WorkflowDefinitionInput } from "@/domain/workflows/definition";
import { workflowConditionLabels, workflowConditions, type WorkflowCondition } from "@/domain/workflows/evaluate-condition";

type Step = WorkflowDefinitionInput["steps"][number];

const conditionLabels: Record<string, string> = {
  IS_FOLLOWER: "El fan es seguidor",
  IS_FOLLOWER_ONLY: "Es solamente seguidor (sin suscripción)",
  IS_SUBSCRIBER: "Tiene cualquier suscripción activa",
  IS_PAID_SUBSCRIBER: "Tiene suscripción de pago activa",
  IS_FREE_TRIAL_SUBSCRIBER: "Tiene una prueba gratuita activa",
  IS_AUTO_RENEWING_SUBSCRIBER: "Tiene renovación automática",
  IS_NON_RENEWING_SUBSCRIBER: "Tiene la renovación desactivada",
  IS_EXPIRED_SUBSCRIBER: "Tiene una suscripción caducada",
  IS_ONLINE: "Está conectado ahora",
  IS_MUTED: "Está silenciado",
  IS_CREATOR_ACCOUNT: "Es otra cuenta de creador",
  HAS_PURCHASED: "Ha realizado una compra",
  HAS_NOT_PURCHASED: "No ha realizado ninguna compra",
  SPENT_MORE_THAN_50: "Ha gastado más de $50",
  SPENT_LESS_THAN: "Ha gastado menos de $50",
  HAS_SPENT_ZERO: "Ha gastado exactamente $0",
  IS_NOT_SUBSCRIBER: "No tiene ninguna suscripción activa",
  IS_NOT_FREE_TRIAL_SUBSCRIBER: "No tiene una prueba gratuita activa",
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
    if (Array.isArray(step.config.conditions)) {
      const labels = step.config.conditions.flatMap((value) => {
        if (typeof value !== "object" || !value || Array.isArray(value)) return [];
        const rule = value as Record<string, unknown>;
        const condition = String(rule.condition) as WorkflowCondition;
        if (!workflowConditions.includes(condition)) return [];
        if (typeof rule.amountMinor === "number" && condition === "SPENT_MORE_THAN_50") return [`Ha gastado más de $${(rule.amountMinor / 100).toFixed(2)}`];
        if (typeof rule.amountMinor === "number" && condition === "SPENT_LESS_THAN") return [`Ha gastado menos de $${(rule.amountMinor / 100).toFixed(2)}`];
        return [workflowConditionLabels[condition]];
      });
      return labels.length ? labels.join(step.config.conditionOperator === "ANY" ? " O " : " Y ") : "Condición no configurada";
    }
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
