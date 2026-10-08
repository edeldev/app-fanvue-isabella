import { describe, expect, it } from "vitest";
import { isConversationPredominantlySpanish, shouldOfferSpanishTranslation } from "./language-hint";

describe("shouldOfferSpanishTranslation", () => {
  it("does not offer translation for clear Spanish", () => {
    expect(shouldOfferSpanishTranslation("Hola, ¿cómo estás? Me gustó mucho")).toBe(false);
    expect(shouldOfferSpanishTranslation("Buenas noches, hermosa")).toBe(false);
  });

  it("offers translation for clear English", () => {
    expect(shouldOfferSpanishTranslation("Hey, how are you? I love this")).toBe(true);
    expect(shouldOfferSpanishTranslation("I really love this photo", true)).toBe(true);
  });

  it("uses Spanish conversation context for mixed or ambiguous messages", () => {
    const conversation = ["Hola, ¿cómo estás?", "Me encantan tus fotos", "Buenas noches"];
    expect(isConversationPredominantlySpanish(conversation)).toBe(true);
    expect(shouldOfferSpanishTranslation("Hola love", true)).toBe(false);
    expect(shouldOfferSpanishTranslation("Qué linda photo", true)).toBe(false);
  });

  it("ignores messages without words", () => {
    expect(shouldOfferSpanishTranslation("😍🔥")).toBe(false);
  });
});
