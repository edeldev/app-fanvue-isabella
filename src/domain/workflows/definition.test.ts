import { describe, expect, it } from "vitest";
import { workflowDefinitionInputSchema } from "./definition";

describe("workflowDefinitionInputSchema", () => {
  it("accepts a valid message, wait and end sequence", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Conversión de seguidores",
      priority: 100,
      isPrimary: true,
      steps: [
        { name: "Saludo", type: "SEND_MESSAGE", messageTemplateId: "template-1", config: {} },
        { name: "Esperar respuesta", type: "WAIT", config: { durationMinutes: 60 } },
        { name: "Finalizar", type: "END", config: {} },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a message without a template", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Flujo inválido", priority: 1, isPrimary: true,
      steps: [
        { name: "Mensaje", type: "SEND_MESSAGE", config: {} },
        { name: "Finalizar", type: "END", config: {} },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires exactly one final step in the last position", () => {
    const result = workflowDefinitionInputSchema.safeParse({
      name: "Flujo sin cierre", priority: 1, isPrimary: true,
      steps: [{ name: "Esperar", type: "WAIT", config: { durationMinutes: 5 } }],
    });
    expect(result.success).toBe(false);
  });
});
