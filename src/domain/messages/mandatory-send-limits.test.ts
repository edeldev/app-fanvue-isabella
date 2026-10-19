import { describe, expect, it } from "vitest";
import { mandatoryAutomatedSendLimits } from "./mandatory-send-limits";

describe("mandatoryAutomatedSendLimits", () => {
  it("protects creators without saved settings", () => {
    expect(mandatoryAutomatedSendLimits(null)).toEqual({ maxMessagesPerHour: 30, maxMessagesPerDay: 200, minMinutesBetweenFanMessages: 0 });
  });

  it("protects legacy accounts without changing their per-fan workflow timing", () => {
    expect(mandatoryAutomatedSendLimits({ sendLimitsEnabled: false, maxMessagesPerHour: 15, maxMessagesPerDay: 80, minMinutesBetweenFanMessages: 60 })).toEqual({ maxMessagesPerHour: 15, maxMessagesPerDay: 80, minMinutesBetweenFanMessages: 0 });
  });

  it("keeps stricter settings but never accepts higher hourly or daily caps", () => {
    expect(mandatoryAutomatedSendLimits({ sendLimitsEnabled: true, maxMessagesPerHour: 1_000, maxMessagesPerDay: 10_000, minMinutesBetweenFanMessages: 10 })).toEqual({ maxMessagesPerHour: 30, maxMessagesPerDay: 200, minMinutesBetweenFanMessages: 10 });
  });
});
