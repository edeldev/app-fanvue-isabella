import { describe, expect, it } from "vitest";
import { resolveReplyPausePolicy } from "./reply-pause-policy";

const steps = [
  { id: "wait", position: 0, type: "WAIT", config: { stepKey: "wait", durationMinutes: 60 } },
  { id: "message", position: 1, type: "SEND_MESSAGE", config: { stepKey: "message", replyPauseMode: "CUSTOM", replySilenceMinutes: 10 } },
  { id: "end", position: 2, type: "END", config: { stepKey: "end" } },
];

describe("reply pause policy", () => {
  it("uses the upcoming message override while the enrollment is waiting", () => {
    expect(resolveReplyPausePolicy({ currentStepId: "wait", steps, globalEnabled: true, globalSilenceMinutes: 60 })).toEqual({ enabled: true, silenceMinutes: 10, source: "STEP", stepId: "message" });
  });

  it("allows a message to opt out", () => {
    const disabled = steps.map((step) => step.id === "message" ? { ...step, config: { ...step.config, replyPauseMode: "DISABLED" } } : step);
    expect(resolveReplyPausePolicy({ currentStepId: "wait", steps: disabled, globalEnabled: true, globalSilenceMinutes: 60 }).enabled).toBe(false);
  });

  it("falls back to the workflow value for existing message steps", () => {
    const legacy = steps.map((step) => step.id === "message" ? { ...step, config: { stepKey: "message" } } : step);
    expect(resolveReplyPausePolicy({ currentStepId: "wait", steps: legacy, globalEnabled: true, globalSilenceMinutes: 30 })).toMatchObject({ enabled: true, silenceMinutes: 30, source: "GLOBAL" });
  });

  it("does not pause when there is no future message", () => {
    expect(resolveReplyPausePolicy({ currentStepId: "end", steps, globalEnabled: true, globalSilenceMinutes: 60 }).enabled).toBe(false);
  });
});

