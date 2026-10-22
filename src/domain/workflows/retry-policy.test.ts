import { describe, expect, it } from "vitest";
import { FanvueAuthenticationError, FanvueError } from "@/lib/fanvue/errors";
import { ConfirmedSendPersistenceError, workflowRetryDecision, workflowSendRetryDecision } from "./retry-policy";

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

describe("workflowSendRetryDecision", () => {
  it.each([
    ["FANVUE_RECIPIENT_UNAVAILABLE", "FANVUE_RECIPIENT_UNAVAILABLE"],
    ["FANVUE_INVALID_RECIPIENT_ID", "FANVUE_INVALID_RECIPIENT_ID"],
    ["FANVUE_MESSAGE_REJECTED", "FANVUE_MESSAGE_REJECTED"],
  ])("stops known Fanvue 400 errors without retrying", (code, reasonCode) => {
    expect(workflowSendRetryDecision(new FanvueError("bad request", 400, code), 1)).toEqual({ retryable: false, reasonCode, delaySeconds: null });
  });
  it("never repeats a message Fanvue already confirmed", () => {
    expect(workflowSendRetryDecision(new ConfirmedSendPersistenceError("message-1"), 1)).toEqual({ retryable: false, reasonCode: "FANVUE_SEND_CONFIRMED_PERSISTENCE_FAILED", delaySeconds: null });
  });
  it("retries only confirmed rate limits and respects Retry-After", () => {
    expect(workflowSendRetryDecision(new FanvueError("limited", 429, "FANVUE_RATE_LIMIT", 420), 1)).toMatchObject({ retryable: true, reasonCode: "FANVUE_RATE_LIMIT", delaySeconds: 420 });
  });

  it.each([new TypeError("connection lost"), new SyntaxError("invalid JSON response"), new FanvueError("timeout", 408, "FANVUE_API_ERROR"), new FanvueError("unavailable", 503, "FANVUE_API_ERROR"), new FanvueError("invalid response", 502, "FANVUE_INVALID_RESPONSE")])("stops ambiguous sends for manual review", (error) => {
    expect(workflowSendRetryDecision(error, 1)).toEqual({ retryable: false, reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE", delaySeconds: null });
  });
});
