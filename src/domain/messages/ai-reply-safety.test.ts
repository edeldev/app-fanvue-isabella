import { describe, expect, it } from "vitest";
import { enforceAiIdentityBoundary } from "./ai-reply-safety";

const base = { reply: "No soy IA, soy una persona real.", spanishTranslation: "", needsSpanishTranslation: false, detectedLanguage: "Español", tone: "coqueto" };

describe("enforceAiIdentityBoundary", () => {
  it("replaces a false human claim when the fan asks about AI", () => {
    const result = enforceAiIdentityBoundary(base, "¿Eres una IA o una persona?");
    expect(result.reply).not.toMatch(/no soy IA|persona real/i);
    expect(result.reply).toContain("asistente de IA");
  });

  it("answers transparently even when the model did not make a false claim", () => {
    const result = enforceAiIdentityBoundary({ ...base, reply: "¿Qué te hizo preguntarlo?" }, "¿Eres un bot?");
    expect(result.reply).toContain("asistente de IA");
  });

  it("does not alter unrelated replies", () => {
    expect(enforceAiIdentityBoundary(base, "¿Cómo estuvo tu día?")).toEqual(base);
  });

  it.each([
    ["Português", "Você é uma IA?", "Uso um assistente"],
    ["Français", "Tu es un bot ?", "J'utilise un assistant"],
    ["Deutsch", "Bist du ein Bot?", "Ich nutze einen"],
    ["Italiano", "Sei un bot?", "Uso un assistente"],
    ["English", "Are you an AI?", "I use an AI"],
  ])("answers transparently in %s with a Spanish preview", (detectedLanguage, question, expected) => {
    const result = enforceAiIdentityBoundary({ ...base, detectedLanguage }, question);
    expect(result.reply).toContain(expected);
    expect(result.spanishTranslation).toContain("asistente de IA");
    expect(result.needsSpanishTranslation).toBe(true);
  });

  it("does not mistake a mention of AI for a question about the assistant", () => {
    expect(enforceAiIdentityBoundary(base, "Vi una foto hecha con IA.")).toEqual(base);
  });
});
