import { describe, expect, it } from "vitest";
import { isInsideSendWindow, nextSendWindowOpening } from "./send-window";

const dailyWindow = { enabled: true, timeZone: "UTC", startMinute: 9 * 60, endMinute: 22 * 60, days: [0, 1, 2, 3, 4, 5, 6] };

describe("send window", () => {
  it("allows messages inside the configured period", () => {
    expect(isInsideSendWindow(new Date("2026-09-09T10:00:00.000Z"), dailyWindow)).toBe(true);
    expect(isInsideSendWindow(new Date("2026-09-09T22:00:00.000Z"), dailyWindow)).toBe(false);
    expect(isInsideSendWindow(new Date("2026-09-09T03:00:00.000Z"), { ...dailyWindow, enabled: false })).toBe(true);
  });

  it("finds the next opening without discarding the message", () => {
    expect(nextSendWindowOpening(new Date("2026-09-09T22:30:42.000Z"), dailyWindow).toISOString()).toBe("2026-09-10T09:00:00.000Z");
  });

  it("supports periods that cross midnight", () => {
    const overnight = { enabled: true, timeZone: "UTC", startMinute: 22 * 60, endMinute: 2 * 60, days: [1] };
    expect(isInsideSendWindow(new Date("2026-09-07T23:00:00.000Z"), overnight)).toBe(true);
    expect(isInsideSendWindow(new Date("2026-09-08T01:00:00.000Z"), overnight)).toBe(true);
    expect(isInsideSendWindow(new Date("2026-09-08T02:00:00.000Z"), overnight)).toBe(false);
  });
});
