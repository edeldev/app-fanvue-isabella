import { describe, expect, it } from "vitest";
import type { WorkflowDefinitionInput } from "./definition";
import { reorderWorkflowSteps } from "./visual-builder";

const steps: WorkflowDefinitionInput["steps"] = [
  { name: "Mensaje", type: "SEND_MESSAGE", messageTemplateId: "template", config: { stepKey: "message", nextTargetKey: "condition" } },
  { name: "Condición", type: "CONDITION", messageTemplateId: null, config: { stepKey: "condition", condition: "IS_FOLLOWER", trueTargetKey: "wait", falseTargetKey: "end" } },
  { name: "Espera", type: "WAIT", messageTemplateId: null, config: { stepKey: "wait", durationMinutes: 10 } },
  { name: "Finalizar", type: "END", messageTemplateId: null, config: { stepKey: "end" } },
];

describe("visual workflow builder", () => {
  it("moves a block while keeping Finalizar last", () => {
    expect(reorderWorkflowSteps(steps, 2, 0).map((step) => step.config.stepKey)).toEqual(["wait", "message", "condition", "end"]);
  });

  it("clears connections that become backward after dragging", () => {
    const reordered = reorderWorkflowSteps(steps, 2, 0);
    expect(reordered[0].config.nextTargetKey).toBeUndefined();
    expect(reordered[2].config.trueTargetKey).toBeUndefined();
    expect(reordered[2].config.falseTargetKey).toBe("end");
  });

  it("does not allow moving the final block", () => {
    expect(reorderWorkflowSteps(steps, 3, 0)).toBe(steps);
  });
});
