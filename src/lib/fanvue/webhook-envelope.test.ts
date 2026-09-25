import { describe, expect, it } from "vitest";
import { creatorUuidFromWebhookData } from "./webhook-envelope";

describe("creatorUuidFromWebhookData", () => {
  it("extrae el creador oficial del webhook", () => {
    expect(creatorUuidFromWebhookData({ creator: { uuid: "creator-123" } })).toBe("creator-123");
  });

  it("rechaza eventos que no identifican al creador", () => {
    expect(creatorUuidFromWebhookData({ fan: { uuid: "fan-123" } })).toBeNull();
    expect(creatorUuidFromWebhookData(null)).toBeNull();
  });
});
