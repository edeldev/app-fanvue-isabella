import { describe, expect, it } from "vitest";
import { reentryBlockedReason } from "./reentry-policy";

const now = new Date("2026-09-09T12:00:00.000Z");

describe("reentryBlockedReason", () => {
  it("allows the first enrollment for every policy", () => {
    expect(reentryBlockedReason("ONCE", null, null, now)).toBeNull();
    expect(reentryBlockedReason("AFTER_DELAY", null, 7, now)).toBeNull();
    expect(reentryBlockedReason("EVERY_EVENT", null, null, now)).toBeNull();
  });

  it("blocks a workflow configured for one execution per fan", () => {
    expect(reentryBlockedReason("ONCE", { reentryReferenceAt: new Date("2026-01-01T00:00:00.000Z") }, null, now)).toEqual({
      code: "WORKFLOW_REENTRY_ONCE",
      eligibleAt: null,
    });
  });

  it("enforces and then releases a cooldown", () => {
    const recent = reentryBlockedReason("AFTER_DELAY", { reentryReferenceAt: new Date("2026-09-05T12:00:00.000Z") }, 7, now);
    expect(recent).toEqual({ code: "WORKFLOW_REENTRY_COOLDOWN", eligibleAt: new Date("2026-09-12T12:00:00.000Z") });
    expect(reentryBlockedReason("AFTER_DELAY", { reentryReferenceAt: new Date("2026-09-01T12:00:00.000Z") }, 7, now)).toBeNull();
  });

  it("allows a terminal workflow again on every new event", () => {
    expect(reentryBlockedReason("EVERY_EVENT", { reentryReferenceAt: new Date("2026-09-09T11:59:00.000Z") }, null, now)).toBeNull();
  });
});
