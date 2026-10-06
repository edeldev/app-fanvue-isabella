import { describe, expect, it } from "vitest";
import { scheduleWorkflowStep } from "./step-schedule";

const now = new Date("2026-10-05T16:00:00.000Z");

describe("scheduleWorkflowStep", () => {
  it("initializes reply waits without marking them due immediately", () => {
    expect(scheduleWorkflowStep({ id: "reply", type: "WAIT_FOR_REPLY", config: { timeoutMinutes: 10 } }, now)).toEqual({
      status: "ACTIVE",
      currentStepId: "reply",
      nextRunAt: null,
      completedAt: null,
    });
  });

  it("keeps regular waits scheduled for their configured duration", () => {
    expect(scheduleWorkflowStep({ id: "wait", type: "WAIT", config: { durationMinutes: 10 } }, now).nextRunAt).toEqual(new Date("2026-10-05T16:10:00.000Z"));
  });

  it("makes an immediately executable message due now", () => {
    expect(scheduleWorkflowStep({ id: "message", type: "SEND_MESSAGE", config: {} }, now).nextRunAt).toEqual(now);
  });
});
