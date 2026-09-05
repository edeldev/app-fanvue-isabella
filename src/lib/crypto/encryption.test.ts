import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./encryption";

describe("secret encryption", () => {
  const key = "a-test-secret-with-at-least-32-characters";

  it("round trips without exposing plaintext", () => {
    const encrypted = encryptSecret("access-token", key);
    expect(encrypted).not.toContain("access-token");
    expect(decryptSecret(encrypted, key)).toBe("access-token");
  });

  it("detects tampering", () => {
    const encrypted = encryptSecret("access-token", key);
    const parts = encrypted.split(".");
    parts[3] = `${parts[3]?.startsWith("A") ? "B" : "A"}${parts[3]?.slice(1)}`;
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });
});
