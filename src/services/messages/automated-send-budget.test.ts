import { describe, expect, it } from "vitest";
import { evaluateAutomatedSendBuckets } from "./automated-send-budget";

const now = new Date("2026-10-19T12:00:00.000Z");
const limits = { maxMessagesPerHour: 30, maxMessagesPerDay: 200, minMinutesBetweenFanMessages: 0 };

describe("automated send budget", () => {
  it("preserves short planned waits when fan interval is zero", () => {
    expect(evaluateAutomatedSendBuckets({ hour: null, day: null, fan: { requestCount: 1, expiresAt: new Date("2026-10-19T13:00:00.000Z") } }, limits, now)).toEqual({ allowed: true });
  });

  it("defers until the latest active limit expires", () => {
    const result = evaluateAutomatedSendBuckets({
      hour: { requestCount: 30, expiresAt: new Date("2026-10-19T12:40:00.000Z") },
      day: { requestCount: 200, expiresAt: new Date("2026-10-20T12:00:00.000Z") },
      fan: null,
    }, limits, now);
    expect(result).toEqual({ allowed: false, reasonCode: "AUTOMATED_DAILY_LIMIT", nextRunAt: new Date("2026-10-20T12:00:00.000Z") });
  });

  it("honors an explicit per-fan interval", () => {
    expect(evaluateAutomatedSendBuckets({ hour: null, day: null, fan: { requestCount: 1, expiresAt: new Date("2026-10-19T12:10:00.000Z") } }, { ...limits, minMinutesBetweenFanMessages: 10 }, now))
      .toEqual({ allowed: false, reasonCode: "AUTOMATED_FAN_INTERVAL", nextRunAt: new Date("2026-10-19T12:10:00.000Z") });
  });
});
