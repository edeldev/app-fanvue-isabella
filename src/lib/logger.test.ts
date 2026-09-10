import { describe, expect, it } from "vitest";
import { sanitizeContext, sanitizeErrorMessage } from "./logger";

describe("sanitizeContext", () => {
  it("redacts credential-like fields", () => {
    expect(sanitizeContext({ accessToken: "unsafe", requestId: "safe" })).toEqual({
      accessToken: "[REDACTED]",
      requestId: "safe",
    });
  });

  it("redacts nested credentials and sensitive URL values", () => {
    expect(sanitizeContext({ request: { headers: { authorization: "Bearer unsafe" } }, url: "https://example.test?code=unsafe&safe=1" })).toEqual({
      request: { headers: { authorization: "[REDACTED]" } },
      url: "https://example.test?code=[REDACTED]&safe=1",
    });
    expect(sanitizeErrorMessage("Failed with Bearer abc123")).toBe("Failed with Bearer [REDACTED]");
  });
});
