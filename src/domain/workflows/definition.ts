import { z } from "zod";
import { workflowConditions } from "./evaluate-condition";
import { workflowTriggers } from "./triggers";
import { workflowReentryPolicies } from "./reentry-policy";
import { workflowGoalTypes } from "./conversion-goal";

export const editableStepTypes = [
  "SEND_MESSAGE",
  "WAIT",
  "SEND_PPV",
  "CONDITION",
  "CHANGE_WORKFLOW",
  "END",
] as const;

export const workflowStepInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(editableStepTypes),
  messageTemplateId: z.string().min(1).nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
}).superRefine((step, context) => {
  if (["SEND_MESSAGE", "SEND_PPV"].includes(step.type) && !step.messageTemplateId) {
    context.addIssue({ code: "custom", path: ["messageTemplateId"], message: "Selecciona una plantilla." });
  }
  if (step.type === "WAIT") {
    const result = z.number().int().min(1).max(43_200).safeParse(step.config.durationMinutes);
    if (!result.success) context.addIssue({ code: "custom", path: ["config", "durationMinutes"], message: "La espera debe estar entre 1 minuto y 30 días." });
  }
  if (step.type === "CONDITION") {
    const legacyValid = workflowConditions.includes(String(step.config.condition) as (typeof workflowConditions)[number]);
    const rules = Array.isArray(step.config.conditions) ? step.config.conditions : [];
    const rulesValid = rules.length > 0 && rules.length <= 10 && rules.every((value) => {
      if (typeof value !== "object" || !value || Array.isArray(value)) return false;
      const rule = value as Record<string, unknown>;
      if (!workflowConditions.includes(String(rule.condition) as (typeof workflowConditions)[number])) return false;
      return !["SPENT_MORE_THAN_50", "SPENT_LESS_THAN"].includes(String(rule.condition)) || (typeof rule.amountMinor === "number" && Number.isInteger(rule.amountMinor) && rule.amountMinor >= 0);
    });
    if (!legacyValid && !rulesValid) context.addIssue({ code: "custom", path: ["config", "conditions"], message: "Agrega al menos una condición válida." });
    if (rulesValid && !["ALL", "ANY"].includes(String(step.config.conditionOperator))) context.addIssue({ code: "custom", path: ["config", "conditionOperator"], message: "Selecciona cómo combinar las condiciones." });
  }
  if (step.type === "CHANGE_WORKFLOW" && typeof step.config.targetWorkflowId !== "string") {
    context.addIssue({ code: "custom", path: ["config", "targetWorkflowId"], message: "Selecciona el flujo de destino." });
  }
});

export const workflowDefinitionInputSchema = z.object({
  name: z.string().trim().min(3).max(100),
  priority: z.number().int().min(0).max(1000),
  isPrimary: z.boolean(),
  triggerEvent: z.enum(workflowTriggers).default("MANUAL"),
  reentryPolicy: z.enum(workflowReentryPolicies).default("ONCE"),
  reentryDelayDays: z.number().int().min(1).max(365).nullable().default(null),
  sendWindowEnabled: z.boolean().default(false),
  sendWindowTimezone: z.string().min(1).max(100).default("America/Monterrey"),
  sendWindowStartMinute: z.number().int().min(0).max(1_439).default(540),
  sendWindowEndMinute: z.number().int().min(0).max(1_439).default(1_320),
  sendWindowDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  sendLimitsEnabled: z.boolean().default(false),
  maxMessagesPerHour: z.number().int().min(1).max(1_000).default(30),
  maxMessagesPerDay: z.number().int().min(1).max(10_000).default(200),
  minMinutesBetweenFanMessages: z.number().int().min(0).max(43_200).default(60),
  pauseOnFanReply: z.boolean().default(false),
  replySilenceMinutes: z.number().int().min(1).max(43_200).default(60),
  replyAttributionHours: z.number().int().min(1).max(720).default(24),
  goalType: z.enum(workflowGoalTypes).default("NONE"),
  goalAmountMinor: z.number().int().min(1).nullable().default(null),
  steps: z.array(workflowStepInputSchema).min(1).max(50),
}).superRefine((workflow, context) => {
  if (workflow.reentryPolicy === "AFTER_DELAY" && workflow.reentryDelayDays === null) {
    context.addIssue({ code: "custom", path: ["reentryDelayDays"], message: "Indica cuántos días deben pasar antes del reingreso." });
  }
  if (workflow.goalType === "SPEND_AMOUNT" && workflow.goalAmountMinor === null) {
    context.addIssue({ code: "custom", path: ["goalAmountMinor"], message: "Indica la cantidad de gasto que completa el objetivo." });
  }
  const endPositions = workflow.steps.flatMap((step, index) => step.type === "END" ? [index] : []);
  if (endPositions.length !== 1 || endPositions[0] !== workflow.steps.length - 1) {
    context.addIssue({ code: "custom", path: ["steps"], message: "El flujo debe terminar con un único paso Finalizar." });
  }
  const keys = workflow.steps.map((step) => typeof step.config.stepKey === "string" ? step.config.stepKey : null);
  if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["steps"], message: "Cada paso debe tener una referencia interna única." });
  }
  workflow.steps.forEach((step, index) => {
    if (typeof step.config.nextTargetKey === "string") {
      const nextIndex = keys.indexOf(step.config.nextTargetKey);
      if (nextIndex <= index) {
        context.addIssue({ code: "custom", path: ["steps", index, "config", "nextTargetKey"], message: "El siguiente paso personalizado debe estar después del actual." });
      }
    }
    if (step.type !== "CONDITION") return;
    for (const field of ["trueTargetKey", "falseTargetKey"] as const) {
      const targetIndex = keys.indexOf(typeof step.config[field] === "string" ? step.config[field] : null);
      if (targetIndex <= index) {
        context.addIssue({ code: "custom", path: ["steps", index, "config", field], message: "Selecciona un paso posterior para ambas rutas." });
      }
    }
  });
});

export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionInputSchema>;

export const stepTypeLabels: Record<(typeof editableStepTypes)[number], string> = {
  SEND_MESSAGE: "Enviar mensaje",
  WAIT: "Esperar",
  SEND_PPV: "Enviar PPV",
  CONDITION: "Evaluar condición",
  CHANGE_WORKFLOW: "Cambiar de flujo",
  END: "Finalizar",
};
