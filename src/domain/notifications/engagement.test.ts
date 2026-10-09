import { describe, expect, it } from "vitest";
import { engagementCopy, engagementEventTypes } from "./engagement";

describe("engagement notifications", () => {
  it("includes received messages in the real-time feed", () => {
    expect(engagementEventTypes).toContain("MESSAGE_RECEIVED");
    expect(
      engagementCopy("MESSAGE_RECEIVED", "Juan", { text: "Hola 👋" }),
    ).toEqual({ title: "Nuevo mensaje", message: "Juan: Hola 👋" });
  });

  it("uses a safe fallback when a message has no text", () => {
    expect(engagementCopy("MESSAGE_RECEIVED", "Juan", {})).toEqual({
      title: "Nuevo mensaje",
      message: "Juan te envió un mensaje.",
    });
  });
});
