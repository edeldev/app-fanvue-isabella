import { describe, expect, it } from "vitest";
import { extendWorkflowPath } from "./transition-path";

describe("workflow transition path", () => {
  it("extends a new transition path", () => {
    expect(extendWorkflowPath(null, "flow-a", "flow-b")).toEqual(["flow-a", "flow-b"]);
  });

  it("rejects direct and indirect cycles", () => {
    expect(() => extendWorkflowPath(["flow-a", "flow-b"], "flow-b", "flow-a")).toThrow("WORKFLOW_CHANGE_CYCLE_DETECTED");
    expect(() => extendWorkflowPath(["flow-a"], "flow-a", "flow-a")).toThrow("WORKFLOW_CHANGE_CYCLE_DETECTED");
  });
});
