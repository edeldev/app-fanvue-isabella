import { describe, expect, it } from "vitest";
import { workflowStepContext } from "./step-context";

const templates = new Map([["welcome", "Bienvenida personal"]]);
const workflows = new Map([["vip", "Atención VIP"]]);

describe("workflowStepContext", () => {
  it("shows the selected message template", () => {
    expect(workflowStepContext({ name: "Mensaje", type: "SEND_MESSAGE", messageTemplateId: "welcome", config: {} }, templates, workflows)).toBe("Bienvenida personal");
  });

  it("formats wait durations", () => {
    expect(workflowStepContext({ name: "Espera", type: "WAIT", config: { durationMinutes: 120 } }, templates, workflows)).toBe("2 horas");
    expect(workflowStepContext({ name: "Espera", type: "WAIT", config: { durationMinutes: 2880 } }, templates, workflows)).toBe("2 días");
  });

  it("describes conditions and workflow changes", () => {
    expect(workflowStepContext({ name: "Condición", type: "CONDITION", config: { condition: "HAS_PURCHASED" } }, templates, workflows)).toBe("Ha realizado una compra");
    expect(workflowStepContext({ name: "Condición", type: "CONDITION", config: { conditions: [{ condition: "SPENT_LESS_THAN", amountMinor: 7_500 }], conditionOperator: "ALL" } }, templates, workflows)).toBe("Ha gastado menos de $75.00");
    expect(workflowStepContext({ name: "Cambio", type: "CHANGE_WORKFLOW", config: { targetWorkflowId: "vip" } }, templates, workflows)).toBe("Atención VIP");
  });
});
