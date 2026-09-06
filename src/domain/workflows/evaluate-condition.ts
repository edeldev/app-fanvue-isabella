export type WorkflowCondition = "IS_FOLLOWER" | "IS_SUBSCRIBER" | "HAS_PURCHASED" | "IS_TOP_SPENDER";

export interface ConditionFan {
  isFollower: boolean;
  isSubscriber: boolean;
  isTopSpender: boolean;
  purchasesCount: number;
}

export function evaluateWorkflowCondition(condition: WorkflowCondition, fan: ConditionFan) {
  if (condition === "IS_FOLLOWER") return fan.isFollower;
  if (condition === "IS_SUBSCRIBER") return fan.isSubscriber;
  if (condition === "HAS_PURCHASED") return fan.purchasesCount > 0;
  return fan.isTopSpender;
}
