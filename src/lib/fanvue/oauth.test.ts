import { describe, expect, it } from "vitest";
import { createOAuthState, createPkcePair } from "./oauth";

describe("Fanvue OAuth primitives", () => {
  it("creates an RFC 7636 compatible S256 pair", () => {
    const pair = createPkcePair();
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.verifier.length).toBeLessThanOrEqual(128);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("creates a high entropy state", () => {
    expect(createOAuthState().length).toBeGreaterThanOrEqual(43);
  });
});

