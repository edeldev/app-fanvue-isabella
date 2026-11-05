import { describe, expect, it } from "vitest";
import { canReceivePaidOrIntimateContent, canReceiveMessageMedia } from "./content-consent";

describe("verified intimate-content consent", () => {
  it("accepts only an explicit inbound Fanvue message as evidence", () => {
    expect(canReceivePaidOrIntimateContent({ intimateContentOptIn: false })).toBe(false);
    expect(canReceivePaidOrIntimateContent({ intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:msg-1" })).toBe(true);
    expect(canReceivePaidOrIntimateContent({ intimateContentOptIn: true, intimateContentOptInSource: "Confirmación manual" })).toBe(false);
    expect(canReceivePaidOrIntimateContent({ intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:" })).toBe(false);
  });

  it("allows SFW media and protects all NSFW media", () => {
    const fan = { intimateContentOptIn: false };
    expect(canReceiveMessageMedia(fan, 0)).toBe(true);
    expect(canReceiveMessageMedia(fan, 1, "SFW")).toBe(true);
    expect(canReceiveMessageMedia(fan, 1, "NSFW")).toBe(false);
    expect(canReceiveMessageMedia({ intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:msg-1" }, 1, "NSFW")).toBe(true);
  });
});
