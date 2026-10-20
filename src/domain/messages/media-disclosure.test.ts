import { describe, expect, it } from "vitest";
import { prepareOutboundMediaText } from "./media-disclosure";

describe("prepareOutboundMediaText", () => {
  it("keeps ordinary text unchanged", () => {
    expect(prepareOutboundMediaText(" Hola ", undefined, 0, false)).toBe("Hola");
  });
  it("does not duplicate disclosure when the AI profile badge is confirmed", () => {
    expect(prepareOutboundMediaText("Hola", "ai_generated", 1, true)).toBe("Hola");
  });
  it("discloses AI media when no profile badge is confirmed", () => {
    expect(prepareOutboundMediaText("Hola", "ai_generated", 1, false)).toContain("Contenido visual generado o alterado con IA.");
  });
  it("blocks unclassified media without a confirmed profile badge", () => {
    expect(() => prepareOutboundMediaText("Hola", undefined, 1, false)).toThrow();
  });
});
