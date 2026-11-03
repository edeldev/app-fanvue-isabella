import { describe, expect, it } from "vitest";
import { resolveMessageDeliveryState } from "./delivery-status";

describe("resolveMessageDeliveryState", () => {
  it("prioritizes the read confirmation", () => {
    expect(resolveMessageDeliveryState({ isRead: true, providerStatus: "Delivered" })).toBe("READ");
    expect(resolveMessageDeliveryState({ storedStatus: "READ" })).toBe("READ");
  });

  it("distinguishes sent and delivered messages", () => {
    expect(resolveMessageDeliveryState({ providerStatus: "Sent" })).toBe("SENT");
    expect(resolveMessageDeliveryState({ storedStatus: "DELIVERED" })).toBe("DELIVERED");
  });

  it("does not claim delivery for pending or failed messages", () => {
    expect(resolveMessageDeliveryState({ storedStatus: "PENDING" })).toBeNull();
    expect(resolveMessageDeliveryState({ storedStatus: "FAILED" })).toBeNull();
  });
});
