import { describe, expect, it } from "vitest";
import { parseGeminiJson, readGeminiInteractionText } from "./interaction-response";

describe("Gemini interaction responses", () => {
  it("reads output_text and model output variants", () => {
    expect(readGeminiInteractionText({ output_text: "  result  " })).toBe("result");
    expect(readGeminiInteractionText({
      steps: [{ type: "model_output", content: [{ type: "output_text", text: "answer" }] }],
    })).toBe("answer");
  });

  it("parses plain, fenced, and surrounded JSON", () => {
    expect(parseGeminiJson('{"reply":"Hola"}')).toEqual({ reply: "Hola" });
    expect(parseGeminiJson('```json\n{"reply":"Hola"}\n```')).toEqual({ reply: "Hola" });
    expect(parseGeminiJson('Aquí está:\n{"reply":"Hola"}\nListo.')).toEqual({ reply: "Hola" });
  });

  it("returns null for unusable output", () => {
    expect(parseGeminiJson("No JSON here")).toBeNull();
  });
});
