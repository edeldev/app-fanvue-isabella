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

describe("messagesPageSchema replied messages", () => {
  it("normalizes the nested reply shape", () => {
    const page = pageWithStatus("Read");
    Object.assign(page.data[0], {
      repliedMessage: { uuid: "original-1", text: "Mensaje anterior", sender: { uuid: "fan-1", handle: "fan" } },
    });
    expect(messagesPageSchema.parse(page).data[0].repliedMessage).toEqual({
      uuid: "original-1",
      text: "Mensaje anterior",
      sender: { uuid: "fan-1", handle: "fan" },
    });
  });

  it("accepts Fanvue's flattened reply variants without rejecting history", () => {
    const page = pageWithStatus("Read");
    Object.assign(page.data[0], {
      repliedMessage: { message_uuid: "original-2", message: "Otra forma", sender_uuid: "fan-1" },
    });
    expect(messagesPageSchema.parse(page).data[0].repliedMessage).toEqual({
      uuid: "original-2",
      text: "Otra forma",
      sender: { uuid: "fan-1" },
    });
  });

  it("normalizes a reply wrapped in a message object", () => {
    const page = pageWithStatus("Read");
    Object.assign(page.data[0], {
      repliedMessage: { message: { id: "original-4", body: "Respuesta envuelta", senderUuid: "fan-1" } },
    });
    expect(messagesPageSchema.parse(page).data[0].repliedMessage).toEqual({
      uuid: "original-4",
      text: "Respuesta envuelta",
      sender: { uuid: "fan-1" },
    });
  });

  it.each([null, [], { unexpected: true }])("ignores an unusable reply value without rejecting history", (repliedMessage) => {
    const page = pageWithStatus("Read");
    Object.assign(page.data[0], { repliedMessage });
    expect(messagesPageSchema.parse(page).data[0].repliedMessage).toBeNull();
  });

  it.each(["replied_message", "replyToMessage", "reply_to_message", "replyTo", "reply_to", "repliedMessageUuid", "replied_message_uuid", "replyToMessageUuid", "reply_to_message_uuid"])("accepts the %s reply alias", (field) => {
    const page = pageWithStatus("Read");
    Object.assign(page.data[0], { [field]: "original-3" });
    expect(messagesPageSchema.parse(page).data[0].repliedMessage).toEqual({
      uuid: "original-3",
      text: null,
      sender: {},
    });
  });

  it("finds Fanvue reply data inside metadata", () => {
    const page = pageWithStatus("Read");
    Object.assign(page.data[0], {
      metadata: {
        quoted_message: {
          uuid: "original-5",
          text: "Cita nativa de Fanvue",
          sender: { uuid: "fan-1", handle: "fan" },
        },
      },
    });
    expect(messagesPageSchema.parse(page).data[0].repliedMessage).toEqual({
      uuid: "original-5",
      text: "Cita nativa de Fanvue",
      sender: { uuid: "fan-1", handle: "fan" },
    });
  });
});
