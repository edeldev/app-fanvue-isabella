import { describe, expect, it } from "vitest";
import { messagesPageSchema } from "./sync-schemas";

function pageWithStatus(status: unknown) {
  return {
    data: [{
      uuid: "message-1",
      text: "Hola",
      sentAt: "2026-11-03T18:00:00.000Z",
      sender: { uuid: "fan-1" },
      status,
    }],
  };
}

describe("messagesPageSchema delivery status", () => {
  it.each(["Sent", "sent", "Delivered", "READ", "Queued"])("accepts Fanvue status %s without rejecting history", (status) => {
    expect(messagesPageSchema.parse(pageWithStatus(status)).data[0].status).toBe(status);
  });

  it("ignores a non-text status instead of rejecting the full conversation", () => {
    expect(messagesPageSchema.parse(pageWithStatus({ state: "Sent" })).data[0].status).toBeNull();
  });
});
