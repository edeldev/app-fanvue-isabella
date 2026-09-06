import { describe, expect, it } from "vitest";
import { evaluateWorkflowCondition } from "./evaluate-condition";

const fan = { isFollower: true, isSubscriber: false, isTopSpender: true, purchasesCount: 2 };

describe("evaluateWorkflowCondition", () => {
  it("evaluates every supported fan condition", () => {
    expect(evaluateWorkflowCondition("IS_FOLLOWER", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_SUBSCRIBER", fan)).toBe(false);
    expect(evaluateWorkflowCondition("HAS_PURCHASED", fan)).toBe(true);
    expect(evaluateWorkflowCondition("IS_TOP_SPENDER", fan)).toBe(true);
  });
});
