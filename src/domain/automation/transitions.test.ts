import { describe, expect, it } from "vitest";
import { assertEnrollmentTransition, canTransitionEnrollment } from "./transitions";

describe("enrollment transitions", () => {
  it("allows pausing and resuming an active enrollment", () => {
    expect(canTransitionEnrollment("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransitionEnrollment("PAUSED", "ACTIVE")).toBe(true);
  });

  it("keeps terminal states terminal", () => {
    expect(canTransitionEnrollment("COMPLETED", "ACTIVE")).toBe(false);
    expect(() => assertEnrollmentTransition("CANCELLED", "ACTIVE")).toThrow(
      "Invalid enrollment transition",
    );
  });
});

