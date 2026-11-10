import { describe, expect, it } from "vitest";
import { fanPassesWorkflowEntryGate } from "./entry-gate";

const fan = {
  isFollower: true,
  isSubscriber: true,
  isFreeTrialSubscriber: false,
  isAutoRenewingSubscriber: true,
  isNonRenewingSubscriber: false,
  isExpiredSubscriber: false,
  isCreatorAccount: false,
  isMuted: false,
  isOnline: false,
  isTopSpender: false,
  totalSpentMinor: 0,
  paidPurchasesCount: 0,
  intimateContentOptIn: false,
  intimateContentOptInSource: null,
};

describe("workflow entry gate", () => {
  it("does not filter workflows without an entry gate", () => {
    expect(fanPassesWorkflowEntryGate([{ type: "CONDITION", config: { condition: "IS_FREE_TRIAL_SUBSCRIBER" } }], fan)).toBe(true);
  });

  it("accepts only fans matching the marked condition", () => {
    const steps = [{ type: "CONDITION", config: { entryGate: true, conditions: [{ condition: "IS_PAID_SUBSCRIBER" }], conditionOperator: "ALL" } }];
    expect(fanPassesWorkflowEntryGate(steps, fan)).toBe(true);
    expect(fanPassesWorkflowEntryGate(steps, { ...fan, isFreeTrialSubscriber: true })).toBe(false);
  });
});
