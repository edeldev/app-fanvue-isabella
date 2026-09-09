import { describe, expect, it } from "vitest";
import { isCronRequestAuthorized } from "./cron-auth";

describe("isCronRequestAuthorized", () => {
  const secret = "a-secure-secret-with-more-than-16-characters";

  it("accepts the exact bearer secret", () => {
    expect(isCronRequestAuthorized(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects missing, short and different secrets", () => {
    expect(isCronRequestAuthorized(null, secret)).toBe(false);
    expect(isCronRequestAuthorized("Bearer short", "short")).toBe(false);
    expect(isCronRequestAuthorized("Bearer another-secure-secret-value", secret)).toBe(false);
  });
});
