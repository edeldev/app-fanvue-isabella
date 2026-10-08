import { describe, expect, it } from "vitest";
import { pickCurrentConversationContext } from "./conversation-context";

const message = (id: string, hour: number, role: "fan" | "creator" = "fan") => ({ id, role, text: id, sentAt: new Date(`2026-10-08T${String(hour).padStart(2, "0")}:00:00.000Z`) });

describe("pickCurrentConversationContext", () => {
  it("keeps only the conversation after a long silence", () => {
    expect(pickCurrentConversationContext([message("old", 1), message("new", 15), message("reply", 16, "creator")]).map((item) => item.id)).toEqual(["new", "reply"]);
  });

  it("preserves a burst of messages from the same context", () => {
    expect(pickCurrentConversationContext([message("one", 10), message("two", 11), message("three", 12)]).map((item) => item.id)).toEqual(["one", "two", "three"]);
  });
});
