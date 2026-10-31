import { describe, expect, it } from "vitest";
import { detectIntimateContentConsent, type ConsentConversationMessage } from "./intimate-consent-detection";

const at = (minute: number) => new Date(`2026-10-31T12:${String(minute).padStart(2, "0")}:00.000Z`);
const message = (id: string, role: "fan" | "creator", text: string, minute: number): ConsentConversationMessage => ({ id, role, text, sentAt: at(minute) });

describe("detectIntimateContentConsent", () => {
  it("accepts a clear reply to a specific consent question", () => {
    const result = detectIntimateContentConsent([
      message("q", "creator", "¿Quieres que te envíe contenido adulto y desnudos?", 0),
      message("a", "fan", "Sí, quiero", 1),
    ], "a");
    expect(result.decision).toBe("GRANTED");
  });

  it("accepts an independent explicit request", () => {
    const result = detectIntimateContentConsent([message("a", "fan", "Quiero que me mandes fotos desnuda", 1)], "a");
    expect(result.decision).toBe("GRANTED");
  });

  it("does not infer consent from an isolated yes or generic interest", () => {
    expect(detectIntimateContentConsent([message("a", "fan", "Sí", 1)], "a").decision).toBe("AMBIGUOUS");
    expect(detectIntimateContentConsent([message("a", "fan", "Quiero ver más", 1)], "a").decision).toBe("NONE");
  });

  it("detects refusal and revocation in context", () => {
    expect(detectIntimateContentConsent([
      message("q", "creator", "¿Quieres recibir contenido +18?", 0),
      message("a", "fan", "No gracias", 1),
    ], "a").decision).toBe("REVOKED");
    expect(detectIntimateContentConsent([
      message("a", "fan", "Ya no quiero que me envíes desnudos", 1),
    ], "a").decision).toBe("REVOKED");
  });

  it("does not confuse exclusivity with rejection of adult content", () => {
    const result = detectIntimateContentConsent([
      message("a", "fan", "No me interesa nadie más en Fanvue, solo tú", 1),
    ], "a");
    expect(result.decision).toBe("NONE");
  });
});
