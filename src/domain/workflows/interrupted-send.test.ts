import { describe, expect, it } from "vitest";
import { interruptedSendGraceMs, isInterruptedWorkflowSend } from "./interrupted-send";

const now = new Date("2026-10-19T12:00:00.000Z");
const base = {
  executionStatus: "RUNNING",
  stepType: "SEND_MESSAGE",
  startedAt: new Date(now.getTime() - interruptedSendGraceMs - 1),
  lockExpiresAt: new Date(now.getTime() - 1),
  now,
};

describe("isInterruptedWorkflowSend", () => {
  it("flags a stale send only after its lock expires", () => {
    expect(isInterruptedWorkflowSend(base)).toBe(true);
    expect(isInterruptedWorkflowSend({ ...base, lockExpiresAt: new Date(now.getTime() + 1) })).toBe(false);
  });

  it("does not flag a fresh send, another step, or a finished execution", () => {
    expect(isInterruptedWorkflowSend({ ...base, startedAt: new Date(now.getTime() - interruptedSendGraceMs) })).toBe(false);
    expect(isInterruptedWorkflowSend({ ...base, stepType: "WAIT" })).toBe(false);
    expect(isInterruptedWorkflowSend({ ...base, executionStatus: "SUCCESS" })).toBe(false);
  });
});
