import { describe, expect, it } from "vitest";
import { matchesWorkflowGoal } from "./conversion-goal";

describe("matchesWorkflowGoal", () => {
  it("does not treat free access or zero-value records as paid conversions", () => {
    expect(matchesWorkflowGoal("PAID_SUBSCRIPTION", null, { kind: "PAYMENT", amountMinor: 0 })).toBe(false);
    expect(matchesWorkflowGoal("ANY_PURCHASE", null, { kind: "PAYMENT", amountMinor: 0 })).toBe(false);
  });

  it("matches a confirmed paid subscription independently from purchases", () => {
    expect(matchesWorkflowGoal("PAID_SUBSCRIPTION", null, { kind: "PAID_SUBSCRIPTION" })).toBe(true);
    expect(matchesWorkflowGoal("FIRST_PURCHASE", null, { kind: "PAID_SUBSCRIPTION" })).toBe(false);
  });

  it("distinguishes first purchase, PPV and tip", () => {
    expect(matchesWorkflowGoal("FIRST_PURCHASE", null, { kind: "PAYMENT", amountMinor: 500, paidPurchasesCount: 1 })).toBe(true);
    expect(matchesWorkflowGoal("FIRST_PURCHASE", null, { kind: "PAYMENT", amountMinor: 500, paidPurchasesCount: 2 })).toBe(false);
    expect(matchesWorkflowGoal("PPV_PURCHASE", null, { kind: "PAYMENT", amountMinor: 500, isPpv: true })).toBe(true);
    expect(matchesWorkflowGoal("TIP_RECEIVED", null, { kind: "PAYMENT", amountMinor: 500, isTip: true })).toBe(true);
  });

  it("completes an accumulated spending target at the exact threshold", () => {
    expect(matchesWorkflowGoal("SPEND_AMOUNT", 7_500, { kind: "PAYMENT", amountMinor: 500, totalSpentMinor: 7_500 })).toBe(true);
    expect(matchesWorkflowGoal("SPEND_AMOUNT", 7_500, { kind: "PAYMENT", amountMinor: 500, totalSpentMinor: 7_499 })).toBe(false);
  });
});
