import { describe, expect, it } from "vitest";
import { maintenanceIsDue, retentionCutoff } from "./retention";

describe("maintenance retention", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("calculates the cutoff without mutating the supplied date", () => {
    expect(retentionCutoff(now, 90).toISOString()).toBe("2026-06-12T12:00:00.000Z");
    expect(now.toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  it("runs once every 24 hours", () => {
    expect(maintenanceIsDue(null, now)).toBe(true);
    expect(maintenanceIsDue(new Date("2026-09-09T12:00:01.000Z"), now)).toBe(false);
    expect(maintenanceIsDue(new Date("2026-09-09T12:00:00.000Z"), now)).toBe(true);
  });
});
