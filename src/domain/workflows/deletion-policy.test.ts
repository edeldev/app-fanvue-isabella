import { describe, expect, it } from "vitest";
import { canDeleteWorkflow } from "./deletion-policy";

describe("canDeleteWorkflow", () => {
  it("allows deleting a draft", () => {
    expect(canDeleteWorkflow("DRAFT", { enrollments: 0, executions: 0 })).toBe(true);
  });

  it("allows deleting a published workflow that was never used", () => {
    expect(canDeleteWorkflow("PUBLISHED", { enrollments: 0, executions: 0 })).toBe(true);
  });

  it("preserves published history after an enrollment or execution", () => {
    expect(canDeleteWorkflow("PUBLISHED", { enrollments: 1, executions: 0 })).toBe(false);
    expect(canDeleteWorkflow("PUBLISHED", { enrollments: 0, executions: 1 })).toBe(false);
  });

  it("does not delete archived definitions", () => {
    expect(canDeleteWorkflow("ARCHIVED", { enrollments: 0, executions: 0 })).toBe(false);
  });
});
