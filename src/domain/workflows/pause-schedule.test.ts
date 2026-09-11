import { describe, expect, it } from "vitest";
import { remainingWaitSeconds, resumedRunAt } from "./pause-schedule";

describe("workflow pause schedule", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("preserves the remaining wait rounded up to a full second", () => {
    expect(remainingWaitSeconds(new Date("2026-09-06T12:40:00.250Z"), now)).toBe(2401);
  });

  it("never stores a negative remaining wait", () => {
    expect(remainingWaitSeconds(new Date("2026-09-06T11:59:00.000Z"), now)).toBe(0);
  });

  it("preserves the pending wait when a fan replies before it expires", () => {
    const repliedAt = new Date("2026-09-11T06:13:47.000Z");
    const scheduledAt = new Date("2026-09-11T06:17:30.000Z");
    expect(remainingWaitSeconds(scheduledAt, repliedAt)).toBe(223);
  });

  it("restores the preserved delay on resume", () => {
    expect(resumedRunAt(2400, now)).toEqual(new Date("2026-09-06T12:40:00.000Z"));
    expect(resumedRunAt(null, now)).toEqual(now);
  });
});
