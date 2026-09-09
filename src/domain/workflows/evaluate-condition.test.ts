import { describe, expect, it } from "vitest";
import { evaluateWorkflowCondition, evaluateWorkflowConditionGroup } from "./evaluate-condition";

const fan = {
  isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false,
  isAutoRenewingSubscriber: false, isNonRenewingSubscriber: false,
  isExpiredSubscriber: false, isCreatorAccount: false, isMuted: false,
  isOnline: true, isTopSpender: true, totalSpentMinor: 5_001, paidPurchasesCount: 2,
};

describe("evaluateWorkflowCondition", () => {
  it("evaluates every supported fan condition", () => {
    expect(evaluateWorkflowCondition("IS_FOLLOWER", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_SUBSCRIBER", fan)).toBe(false);
    expect(evaluateWorkflowCondition("HAS_PURCHASED", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_TOP_SPENDER", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_FOLLOWER_ONLY", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_PAID_SUBSCRIBER", fan)).toBe(false);
    expect(evaluateWorkflowCondition("IS_FREE_TRIAL_SUBSCRIBER", { ...fan, isFreeTrialSubscriber: true })).toBe(true);
    expect(evaluateWorkflowCondition("IS_AUTO_RENEWING_SUBSCRIBER", { ...fan, isAutoRenewingSubscriber: true })).toBe(true);
    expect(evaluateWorkflowCondition("IS_NON_RENEWING_SUBSCRIBER", { ...fan, isNonRenewingSubscriber: true })).toBe(true);
    expect(evaluateWorkflowCondition("IS_EXPIRED_SUBSCRIBER", { ...fan, isExpiredSubscriber: true })).toBe(true);
    expect(evaluateWorkflowCondition("IS_ONLINE", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_MUTED", { ...fan, isMuted: true })).toBe(true);
    expect(evaluateWorkflowCondition("IS_CREATOR_ACCOUNT", { ...fan, isCreatorAccount: true })).toBe(true);
    expect(evaluateWorkflowCondition("SPENT_MORE_THAN_50", fan)).toBe(true);
  });

  it("combines conditions with Y and O", () => {
    expect(evaluateWorkflowConditionGroup("ALL", [{ condition: "IS_FOLLOWER" }, { condition: "IS_ONLINE" }], fan)).toBe(true);
    expect(evaluateWorkflowConditionGroup("ALL", [{ condition: "IS_FOLLOWER" }, { condition: "IS_SUBSCRIBER" }], fan)).toBe(false);
    expect(evaluateWorkflowConditionGroup("ANY", [{ condition: "IS_SUBSCRIBER" }, { condition: "IS_FREE_TRIAL_SUBSCRIBER" }], { ...fan, isFreeTrialSubscriber: true })).toBe(true);
  });

  it("uses a configurable spending threshold", () => {
    expect(evaluateWorkflowConditionGroup("ALL", [{ condition: "SPENT_MORE_THAN_50", amountMinor: 5_000 }], fan)).toBe(true);
    expect(evaluateWorkflowConditionGroup("ALL", [{ condition: "SPENT_MORE_THAN_50", amountMinor: 10_000 }], fan)).toBe(false);
    expect(evaluateWorkflowConditionGroup("ALL", [{ condition: "SPENT_LESS_THAN", amountMinor: 10_000 }], fan)).toBe(true);
    expect(evaluateWorkflowConditionGroup("ALL", [{ condition: "SPENT_LESS_THAN", amountMinor: 5_001 }], fan)).toBe(false);
  });

  it("does not treat a free trial without paid transactions as a purchase", () => {
    const freeTrialFan = {
      ...fan,
      isSubscriber: true,
      isFreeTrialSubscriber: true,
      totalSpentMinor: 0,
      paidPurchasesCount: 0,
    };

    expect(evaluateWorkflowCondition("IS_FREE_TRIAL_SUBSCRIBER", freeTrialFan)).toBe(true);
    expect(evaluateWorkflowCondition("HAS_PURCHASED", freeTrialFan)).toBe(false);
    expect(evaluateWorkflowCondition("HAS_NOT_PURCHASED", freeTrialFan)).toBe(true);
    expect(evaluateWorkflowCondition("HAS_SPENT_ZERO", freeTrialFan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_NOT_SUBSCRIBER", freeTrialFan)).toBe(false);
    expect(evaluateWorkflowCondition("IS_NOT_FREE_TRIAL_SUBSCRIBER", freeTrialFan)).toBe(false);
    expect(evaluateWorkflowConditionGroup("ALL", [
      { condition: "IS_FREE_TRIAL_SUBSCRIBER" },
      { condition: "HAS_PURCHASED" },
    ], freeTrialFan)).toBe(false);
  });

  it("distinguishes no active subscription from no free trial", () => {
    expect(evaluateWorkflowCondition("IS_NOT_SUBSCRIBER", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_NOT_FREE_TRIAL_SUBSCRIBER", fan)).toBe(true);
    expect(evaluateWorkflowCondition("HAS_NOT_PURCHASED", fan)).toBe(false);
    expect(evaluateWorkflowCondition("HAS_SPENT_ZERO", fan)).toBe(false);
  });
});
