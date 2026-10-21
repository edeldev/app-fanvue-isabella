import { describe, expect, it } from "vitest";
import { createPostSchema, postInputError } from "./post-input";

const base = { audience: "subscribers", mediaUuids: ["edc4896e-905e-45ca-8247-62a45bb3563b"] };

describe("createPostSchema", () => {
  it("accepts a photo post without media origin when the profile already discloses AI", () => {
    expect(createPostSchema.safeParse(base).success).toBe(true);
  });

  it("explains an invalid origin instead of a generic validation error", () => {
    const result = createPostSchema.safeParse({ ...base, mediaOrigin: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(postInputError(result.error)).toMatch(/contenido visual/);
  });

  it("identifies invalid media identifiers", () => {
    const result = createPostSchema.safeParse({ ...base, mediaUuids: ["invalid"] });
    expect(result.success).toBe(false);
    if (!result.success) expect(postInputError(result.error)).toMatch(/archivos/);
  });
});
