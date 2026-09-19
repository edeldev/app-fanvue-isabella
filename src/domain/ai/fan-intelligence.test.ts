import { describe, expect, it } from "vitest";
import { extractConversationInterests, scoreFanIntelligence } from "./fan-intelligence";

const now = new Date("2026-09-19T12:00:00.000Z");

describe("fan intelligence", () => {
  it("recognizes a high-value fan from confirmed spending", () => {
    const result = scoreFanIntelligence({ totalSpentMinor: 8_500, purchaseCount: 5, tipCount: 2, inboundMessages: 2, outboundMessages: 4, lastInboundAt: now, lastActivityAt: now, isFollower: true, isSubscriber: true, isFreeTrialSubscriber: false, isAutoRenewingSubscriber: true }, now);
    expect(result.segment).toBe("HIGH_VALUE");
    expect(result.valueScore).toBeGreaterThanOrEqual(70);
  });

  it("recognizes an engaged non-payer as high potential", () => {
    const result = scoreFanIntelligence({ totalSpentMinor: 0, purchaseCount: 0, tipCount: 0, inboundMessages: 9, outboundMessages: 7, lastInboundAt: new Date("2026-09-19T10:00:00.000Z"), lastActivityAt: now, isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false, isAutoRenewingSubscriber: false }, now);
    expect(result.segment).toBe("HIGH_POTENTIAL");
    expect(result.readiness).toBe("HOT");
  });

  it("extracts repeated interests without common words", () => {
    expect(extractConversationInterests(["Me gusta mucho el cosplay", "Tienes más cosplay y fotografía?"])).toEqual(["cosplay"]);
  });
});
