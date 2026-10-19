import { describe, expect, it } from "vitest";
import { nextWorkflowStep } from "./next-step";

const steps = [
  { id: "send", position: 1, config: { nextTargetKey: "finish" } },
  { id: "unused", position: 2, config: { stepKey: "unused" } },
  { id: "finish", position: 3, config: { stepKey: "finish" } },
];

describe("nextWorkflowStep", () => {
  it("follows an explicit branch target", () => {
    expect(nextWorkflowStep(steps, steps[0])?.id).toBe("finish");
  });

  it("falls back to the following position", () => {
    expect(nextWorkflowStep(steps, steps[1])?.id).toBe("finish");
  });
});
