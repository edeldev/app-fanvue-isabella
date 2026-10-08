import { describe, expect, it } from "vitest";
import { enforceAiIdentityBoundary } from "./ai-reply-safety";

const base = { reply: "No soy IA, soy una persona real.", spanishTranslation: "", needsSpanishTranslation: false, detectedLanguage: "Español", tone: "coqueto" };

describe("enforceAiIdentityBoundary", () => {
  it("replaces a false human claim when the fan asks about AI", () => {
    const result = enforceAiIdentityBoundary(base, "¿Eres una IA o una persona?");
    expect(result.reply).not.toMatch(/no soy IA|persona real/i);
    expect(result.reply).toContain("prefiero que me conozcas");
  });

  it("does not alter unrelated replies", () => {
    expect(enforceAiIdentityBoundary(base, "¿Cómo estuvo tu día?")).toEqual(base);
  });
});
