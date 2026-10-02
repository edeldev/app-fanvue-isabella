import { describe, expect, it } from "vitest";
import { buildPurchaseBreakdown, primaryRevenueCategory, purchaseCategory } from "./purchase-breakdown";

describe("purchase breakdown", () => {
  it("categorizes Fanvue revenue sources", () => {
    expect(purchaseCategory({ source: "renewal", amountMinor: 100 })).toBe("subscriptions");
    expect(purchaseCategory({ source: "message", amountMinor: 100 })).toBe("messagePpv");
    expect(purchaseCategory({ source: "post", amountMinor: 100 })).toBe("feedPpv");
    expect(purchaseCategory({ source: "tip", amountMinor: 100 })).toBe("tips");
  });

  it("ignores reversed and zero-value records and identifies the main source", () => {
    const breakdown = buildPurchaseBreakdown([
      { source: "message", amountMinor: 2_000 },
      { source: "tip", amountMinor: 500 },
      { source: "subscription", amountMinor: 1_000 },
      { source: "post", amountMinor: 5_000, reversedAt: new Date() },
      { source: "subscription", amountMinor: 0 },
    ]);
    expect(breakdown.messagePpv).toEqual({ amountMinor: 2_000, count: 1 });
    expect(primaryRevenueCategory(breakdown)).toBe("messagePpv");
  });
});
