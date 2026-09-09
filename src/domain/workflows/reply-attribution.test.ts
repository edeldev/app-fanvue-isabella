import { describe, expect, it } from "vitest";
import { isReplyWithinAttributionWindow } from "./reply-attribution";

describe("isReplyWithinAttributionWindow", () => {
  const sentAt = new Date("2026-09-09T12:00:00.000Z");

  it("attributes a reply received inside the configured window", () => {
    expect(isReplyWithinAttributionWindow(new Date("2026-09-10T11:59:59.000Z"), sentAt, 24)).toBe(true);
  });

  it("includes the exact end of the window", () => {
    expect(isReplyWithinAttributionWindow(new Date("2026-09-10T12:00:00.000Z"), sentAt, 24)).toBe(true);
  });

  it("rejects late replies and replies dated before the message", () => {
    expect(isReplyWithinAttributionWindow(new Date("2026-09-10T12:00:01.000Z"), sentAt, 24)).toBe(false);
    expect(isReplyWithinAttributionWindow(new Date("2026-09-09T11:59:59.000Z"), sentAt, 24)).toBe(false);
  });
});
