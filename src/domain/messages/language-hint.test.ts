import { describe, expect, it } from "vitest";
import { shouldOfferSpanishTranslation } from "./language-hint";

describe("shouldOfferSpanishTranslation", () => {
  it("does not offer translation for clear Spanish", () => {
    expect(shouldOfferSpanishTranslation("Hola, ¿cómo estás? Me gustó mucho")).toBe(false);
    expect(shouldOfferSpanishTranslation("Buenas noches, hermosa")).toBe(false);
  });

  it("offers translation for clear English", () => {
    expect(shouldOfferSpanishTranslation("Hey, how are you? I love this")).toBe(true);
  });

  it("ignores messages without words", () => {
    expect(shouldOfferSpanishTranslation("😍🔥")).toBe(false);
  });
});
