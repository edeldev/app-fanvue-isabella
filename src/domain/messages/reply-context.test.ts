import { describe, expect, it } from "vitest";
import { buildLocalReplyText, parseLocalReplyContext, preserveLocalReplyText } from "./reply-context";

describe("local reply context", () => {
  it("renders reply metadata locally without changing its body", () => {
    const text = buildLocalReplyText("Upset Tortoise", "Hola amor", "Sí");
    expect(parseLocalReplyContext(text)).toEqual({ sender: "Upset Tortoise", excerpt: "Hola amor", body: "Sí" });
  });

  it("keeps local reply metadata when Fanvue echoes the plain body", () => {
    const local = buildLocalReplyText("Upset Tortoise", "Hola amor", "Sí");
    expect(preserveLocalReplyText(local, "Sí")).toBe(local);
  });

  it("uses Fanvue text when it is not the same message", () => {
    const local = buildLocalReplyText("Upset Tortoise", "Hola amor", "Sí");
    expect(preserveLocalReplyText(local, "Otro mensaje")).toBe("Otro mensaje");
  });
});
