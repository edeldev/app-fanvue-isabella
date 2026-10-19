import { describe, expect, it } from "vitest";
import { canReceivePaidOrIntimateContent, canReceiveMessageMedia } from "./content-consent";

describe("canReceivePaidOrIntimateContent", () => {
  it("allows subscribers and explicit opt-in", () => {
    expect(canReceivePaidOrIntimateContent({ isSubscriber: true, isFreeTrialSubscriber: false, intimateContentOptIn: false })).toBe(true);
    expect(canReceivePaidOrIntimateContent({ isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:msg-1" })).toBe(true);
    expect(canReceivePaidOrIntimateContent({ isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: true, intimateContentOptInSource: "Confirmación manual" })).toBe(false);
    expect(canReceivePaidOrIntimateContent({ isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:" })).toBe(false);
  });

  it("blocks unsolicited PPV for a follower without opt-in", () => {
    expect(canReceivePaidOrIntimateContent({ isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: false })).toBe(false);
  });

  it("blocks free media without opt-in while allowing text-only messages", () => {
    const follower = { isSubscriber: false, isFreeTrialSubscriber: false, intimateContentOptIn: false };
    expect(canReceiveMessageMedia(follower, 0)).toBe(true);
    expect(canReceiveMessageMedia(follower, 1)).toBe(false);
    expect(canReceiveMessageMedia({ ...follower, intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:msg-1" }, 1)).toBe(true);
    expect(canReceiveMessageMedia({ ...follower, isFreeTrialSubscriber: true }, 1)).toBe(true);
  });
});
