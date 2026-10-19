import { describe, expect, it } from "vitest";
import { FanvueError } from "@/lib/fanvue/errors";
import { isAmbiguousManualSendFailure, sendIntentRedirectStatus } from "./send-intent";

describe("manual send intent", () => {
  it("never treats an in-flight request as a fresh send", () => {
    expect(sendIntentRedirectStatus("SENDING")).toBe("send_pending");
    expect(sendIntentRedirectStatus("NEEDS_REVIEW")).toBe("send_review");
    expect(sendIntentRedirectStatus("SENT")).toBe("sent");
  });

  it("separates rejected requests from unknown delivery", () => {
    expect(isAmbiguousManualSendFailure(new FanvueError("limited", 429, "FANVUE_RATE_LIMIT"))).toBe(false);
    expect(isAmbiguousManualSendFailure(new FanvueError("unavailable", 503, "FANVUE_API_ERROR"))).toBe(true);
    expect(isAmbiguousManualSendFailure(new TypeError("network lost"))).toBe(true);
  });
});
