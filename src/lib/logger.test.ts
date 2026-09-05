import { describe, expect, it } from "vitest";
import { sanitizeContext } from "./logger";

describe("sanitizeContext", () => {
  it("redacts credential-like fields", () => {
    expect(sanitizeContext({ accessToken: "unsafe", requestId: "safe" })).toEqual({
      accessToken: "[REDACTED]",
      requestId: "safe",
    });
  });
});

