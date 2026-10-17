import { describe, expect, it } from "vitest";
import { describeSubscriptionPeriod } from "./subscription-period";

const now = new Date("2026-10-16T12:00:00Z");

describe("describeSubscriptionPeriod", () => {
  it("uses the newest reported period instead of an old active row", () => {
    const result = describeSubscriptionPeriod([
      { startedAt: new Date("2026-09-01"), currentPeriodEndsAt: new Date("2026-09-27"), status: "ACTIVE" },
      { startedAt: new Date("2026-10-01"), currentPeriodEndsAt: new Date("2026-11-01"), status: "PENDING" },
    ], now);
    expect(result.endValue).toEqual(new Date("2026-11-01"));
    expect(result.endLabel).toBe("Acceso hasta (estimado)");
  });

  it("never presents an expired date as a future expiry", () => {
    const result = describeSubscriptionPeriod([
      { startedAt: new Date("2026-09-01"), currentPeriodEndsAt: new Date("2026-09-27"), status: "ACTIVE" },
    ], now);
    expect(result.endValue).toBeNull();
    expect(result.stale).toBe(true);
  });

  it("shows confirmed active periods and handles missing records", () => {
    expect(describeSubscriptionPeriod([{ startedAt: new Date("2026-10-01"), currentPeriodEndsAt: new Date("2026-11-01"), status: "ACTIVE" }], now).endLabel).toBe("Acceso hasta");
    expect(describeSubscriptionPeriod([], now).endValue).toBeNull();
  });
});
