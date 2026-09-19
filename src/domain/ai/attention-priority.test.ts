import { describe, expect, it } from "vitest";
import { prioritizeFanAttention, type AttentionSignals } from "./attention-priority";

const now = new Date("2026-09-19T16:00:00.000Z");
const base: AttentionSignals = {
  unreadMessages: 0,
  totalSpentMinor: 0,
  inboundMessages: 0,
  outboundMessages: 0,
  lastInboundAt: null,
  lastOutboundAt: null,
  lastActivityAt: null,
  isSubscriber: false,
  isFreeTrialSubscriber: false,
  isNonRenewingSubscriber: false,
  trialEndsAt: null,
};

describe("prioritizeFanAttention", () => {
  it("prioritizes an unanswered message over commercial opportunities", () => {
    const result = prioritizeFanAttention({
      ...base,
      unreadMessages: 2,
      totalSpentMinor: 6_000,
      lastInboundAt: new Date("2026-09-19T15:55:00.000Z"),
    }, now);

    expect(result?.priority).toBe("URGENT");
    expect(result?.reason).toContain("2 mensajes");
  });

  it("flags a free trial that is about to end", () => {
    const result = prioritizeFanAttention({
      ...base,
      isFreeTrialSubscriber: true,
      trialEndsAt: new Date("2026-09-20T16:00:00.000Z"),
    }, now);

    expect(result?.priority).toBe("TODAY");
    expect(result?.reason).toBe("Su prueba gratuita termina mañana");
  });

  it("uses calendar dates instead of treating less than 24 hours as today", () => {
    const result = prioritizeFanAttention({
      ...base,
      isFreeTrialSubscriber: true,
      trialEndsAt: new Date("2026-09-20T15:30:00.000Z"),
    }, now, "America/Monterrey");

    expect(result?.reason).toBe("Su prueba gratuita termina mañana");
  });

  it("recognizes a recent engaged fan with low spend", () => {
    const result = prioritizeFanAttention({
      ...base,
      inboundMessages: 6,
      outboundMessages: 5,
      lastActivityAt: new Date("2026-09-18T16:00:00.000Z"),
    }, now);

    expect(result?.priority).toBe("SOON");
    expect(result?.reason).toContain("potencial");
  });

  it("does not invent urgency for a fan without actionable signals", () => {
    expect(prioritizeFanAttention(base, now)).toBeNull();
  });
});
