import { describe, expect, it } from "vitest";
import { canDeleteWorkflow } from "./deletion-policy";

describe("canDeleteWorkflow", () => {
  it("allows deleting a draft", () => {
    expect(canDeleteWorkflow("DRAFT", { activeEnrollments: 1 })).toBe(true);
  });

  it("allows deleting a published workflow that was never used", () => {
    expect(canDeleteWorkflow("PUBLISHED", { activeEnrollments: 0 })).toBe(true);
  });

  it("blocks deletion while a published workflow is still running", () => {
    expect(canDeleteWorkflow("PUBLISHED", { activeEnrollments: 1 })).toBe(false);
  });

  it("does not delete archived definitions", () => {
    expect(canDeleteWorkflow("ARCHIVED", { activeEnrollments: 0 })).toBe(false);
  });
});
