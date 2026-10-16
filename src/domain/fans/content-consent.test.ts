import { describe, expect, it } from "vitest";
import { canReceivePaidOrIntimateContent } from "./content-consent";

describe("canReceivePaidOrIntimateContent", () => {
  it("allows subscribers and explicit opt-in", () => {
    expect(canReceivePaidOrIntimateContent({ isSubscriber: true, isFreeTrialSubscriber: false, intimateContentOptIn: false })).toBe(true);
    expect(canReceivePaidOrIntimateContent({ isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: true })).toBe(true);
  });

  it("blocks unsolicited PPV for a follower without opt-in", () => {
    expect(canReceivePaidOrIntimateContent({ isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: false })).toBe(false);
  });
});
