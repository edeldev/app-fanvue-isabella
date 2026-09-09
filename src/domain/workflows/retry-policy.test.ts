import { describe, expect, it } from "vitest";
import { FanvueAuthenticationError, FanvueError } from "@/lib/fanvue/errors";
import { workflowRetryDecision } from "./retry-policy";

describe("workflowRetryDecision", () => {
  it("retries temporary failures with increasing delays", () => {
    expect(workflowRetryDecision(new FanvueError("unavailable", 503, "FANVUE_API_ERROR"), 1)).toMatchObject({ retryable: true, delaySeconds: 60 });
    expect(workflowRetryDecision(new FanvueError("unavailable", 503, "FANVUE_API_ERROR"), 2)).toMatchObject({ retryable: true, delaySeconds: 300 });
  });

  it("respects a longer Retry-After value", () => {
    expect(workflowRetryDecision(new FanvueError("limited", 429, "FANVUE_RATE_LIMIT", 420), 1)).toMatchObject({ retryable: true, reasonCode: "FANVUE_RATE_LIMIT", delaySeconds: 420 });
  });

  it("stops after the third attempt and on permanent errors", () => {
    expect(workflowRetryDecision(new FanvueError("unavailable", 503, "FANVUE_API_ERROR"), 3).retryable).toBe(false);
    expect(workflowRetryDecision(new FanvueAuthenticationError(), 1)).toMatchObject({ retryable: false, reasonCode: "FANVUE_AUTHORIZATION_REQUIRED" });
    expect(workflowRetryDecision(new Error("invalid template"), 1).retryable).toBe(false);
  });

  it("does not retry an ambiguous successful response", () => {
    expect(workflowRetryDecision(new FanvueError("invalid response", 502, "FANVUE_INVALID_RESPONSE"), 1)).toMatchObject({ retryable: false, reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE" });
  });
});
