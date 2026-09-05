import { describe, expect, it } from "vitest";
import { initialEnrollmentSchedule } from "./enrollment-schedule";

describe("initialEnrollmentSchedule", () => {
  const now = new Date("2026-09-05T18:00:00.000Z");

  it("schedules an initial wait from the enrollment time", () => {
    expect(initialEnrollmentSchedule({ type: "WAIT", config: { durationMinutes: 60 } }, now)).toEqual({
      status: "WAITING",
      nextRunAt: new Date("2026-09-05T19:00:00.000Z"),
    });
  });

  it("makes non-waiting steps immediately eligible", () => {
    expect(initialEnrollmentSchedule({ type: "SEND_MESSAGE", config: {} }, now)).toEqual({
      status: "ACTIVE",
      nextRunAt: now,
    });
  });
});
