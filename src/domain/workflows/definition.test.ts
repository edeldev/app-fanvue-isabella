import { describe, expect, it } from "vitest";
import { workflowDefinitionInputSchema } from "./definition";

describe("workflowDefinitionInputSchema", () => {
  it("accepts a valid message, wait and end sequence", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Conversión de seguidores",
      priority: 100,
      isPrimary: true,
      steps: [
        { name: "Saludo", type: "SEND_MESSAGE", messageTemplateId: "template-1", config: { stepKey: "message" } },
        { name: "Esperar respuesta", type: "WAIT", config: { durationMinutes: 60, stepKey: "wait" } },
        { name: "Finalizar", type: "END", config: { stepKey: "end" } },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.replyAttributionHours).toBe(24);
  });

  it("rejects an invalid reply attribution window", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Atribución inválida", priority: 1, isPrimary: true, replyAttributionHours: 0,
      steps: [{ name: "Finalizar", type: "END", config: { stepKey: "end" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a message without a template", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Flujo inválido", priority: 1, isPrimary: true,
      steps: [
        { name: "Mensaje", type: "SEND_MESSAGE", config: { stepKey: "message" } },
        { name: "Finalizar", type: "END", config: { stepKey: "end" } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one enabled day when a send window is provided", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Horario inválido", priority: 1, isPrimary: true,
      sendWindowEnabled: true, sendWindowDays: [],
      steps: [{ name: "Finalizar", type: "END", config: { stepKey: "end" } }],
    });
    expect(result.success).toBe(false);
  });

  it("requires an amount for an accumulated spending goal", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Objetivo inválido", priority: 1, isPrimary: true, goalType: "SPEND_AMOUNT",
      steps: [{ name: "Finalizar", type: "END", config: { stepKey: "end" } }],
    });
    expect(result.success).toBe(false);
  });

  it("requires exactly one final step in the last position", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Flujo sin cierre", priority: 1, isPrimary: true,
      steps: [{ name: "Esperar", type: "WAIT", config: { durationMinutes: 5, stepKey: "wait" } }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts forward true and false condition branches", () => {
    expect(workflowDefinitionInputSchema.safeParse({
      name: "Segmentación", priority: 1, isPrimary: true,
      steps: [
        { name: "Condición", type: "CONDITION", config: { stepKey: "condition", condition: "IS_SUBSCRIBER", trueTargetKey: "yes", falseTargetKey: "no" } },
        { name: "Sí", type: "SEND_MESSAGE", messageTemplateId: "one", config: { stepKey: "yes" } },
        { name: "No", type: "SEND_MESSAGE", messageTemplateId: "two", config: { stepKey: "no" } },
        { name: "Fin", type: "END", config: { stepKey: "end" } },
      ],
    }).success).toBe(true);
  });
});
