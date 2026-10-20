import { describe, expect, it } from "vitest";
import { AI_MEDIA_DISCLOSURE, preparePostText } from "./ai-media-disclosure";

describe("preparePostText", () => {
  it("requires media provenance before publishing media", () => {
    expect(() => preparePostText("Hola", undefined, true)).toThrow("Confirma si las fotos");
  });
  it("preserves ordinary captions without an AI disclosure", () => {
    expect(preparePostText(" Hola ", "original", true)).toBe("Hola");
  });
  it("adds a prominent disclosure to AI media even with no caption", () => {
    expect(preparePostText("", "ai_generated", true)).toBe(AI_MEDIA_DISCLOSURE);
    expect(preparePostText("Hola", "ai_generated", true)).toBe(`Hola\n\n${AI_MEDIA_DISCLOSURE}`);
  });
  it("does not duplicate the disclosure", () => {
    expect(preparePostText(AI_MEDIA_DISCLOSURE, "ai_generated", true)).toBe(AI_MEDIA_DISCLOSURE);
  });
  it("uses a confirmed bio disclosure without repeating the caption disclosure", () => {
    expect(preparePostText("Hola", "ai_generated", true, true)).toBe("Hola");
    expect(preparePostText("", "ai_generated", true, true)).toBe("");
    expect(preparePostText("Hola", undefined, true, true)).toBe("Hola");
  });
});
