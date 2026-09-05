import { describe, expect, it } from "vitest";
import { fanvueTokenSchema } from "./schemas";

describe("Fanvue token response", () => {
  it("accepts the optional fields from the official starter contract", () => {
    const token = fanvueTokenSchema.parse({
      access_token: "access",
      token_type: "bearer",
      expires_in: 3600,
    });
    expect(token.scope).toBe("");
    expect(token.refresh_token).toBeUndefined();
  });
});
