import { z } from "zod";

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
  if (step.type === "CONDITION" && typeof step.config.condition !== "string") {
    context.addIssue({ code: "custom", path: ["config", "condition"], message: "Selecciona una condición." });
  }
  if (step.type === "CHANGE_WORKFLOW" && typeof step.config.targetWorkflowId !== "string") {
    context.addIssue({ code: "custom", path: ["config", "targetWorkflowId"], message: "Selecciona el flujo de destino." });
  }
});

export const workflowDefinitionInputSchema = z.object({
  name: z.string().trim().min(3).max(100),
  priority: z.number().int().min(0).max(1000),
  isPrimary: z.boolean(),
  steps: z.array(workflowStepInputSchema).min(1).max(50),
}).superRefine((workflow, context) => {
  const endPositions = workflow.steps.flatMap((step, index) => step.type === "END" ? [index] : []);
  if (endPositions.length !== 1 || endPositions[0] !== workflow.steps.length - 1) {
    context.addIssue({ code: "custom", path: ["steps"], message: "El flujo debe terminar con un único paso Finalizar." });
  }
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
