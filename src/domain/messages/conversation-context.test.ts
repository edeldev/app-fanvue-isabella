import { describe, expect, it } from "vitest";
import { pickCurrentConversationContext, pickCurrentFanTurn } from "./conversation-context";

const message = (id: string, hour: number, role: "fan" | "creator" = "fan") => ({ id, role, text: id, sentAt: new Date(`2026-10-08T${String(hour).padStart(2, "0")}:00:00.000Z`) });

describe("pickCurrentConversationContext", () => {
  it("keeps only the conversation after a long silence", () => {
    expect(pickCurrentConversationContext([message("old", 1), message("new", 15), message("reply", 16, "creator")]).map((item) => item.id)).toEqual(["new", "reply"]);
  });

  it("preserves a burst of messages from the same context", () => {
    expect(pickCurrentConversationContext([message("one", 10), message("two", 11), message("three", 12)]).map((item) => item.id)).toEqual(["one", "two", "three"]);
  });
});

describe("pickCurrentFanTurn", () => {
  it("collects every consecutive fan message after the creator reply", () => {
    const messages = [
      { id: "1", role: "fan" as const, text: "Earlier", sentAt: new Date("2026-10-08T10:00:00Z") },
      { id: "2", role: "creator" as const, text: "Creator reply", sentAt: new Date("2026-10-08T10:01:00Z") },
      { id: "3", role: "fan" as const, text: "I liked the blue outfit", sentAt: new Date("2026-10-08T10:02:00Z") },
      { id: "4", role: "fan" as const, text: "Do you have more like that?", sentAt: new Date("2026-10-08T10:03:00Z") },
    ];
    expect(pickCurrentFanTurn(messages).map((message) => message.id)).toEqual(["3", "4"]);
  });

  it("uses the latest completed fan turn if the creator already replied", () => {
    const messages = [
      { id: "1", role: "fan" as const, text: "Hello", sentAt: new Date("2026-10-08T10:00:00Z") },
      { id: "2", role: "creator" as const, text: "Hey", sentAt: new Date("2026-10-08T10:01:00Z") },
    ];
    expect(pickCurrentFanTurn(messages).map((message) => message.id)).toEqual(["1"]);
  });
});
