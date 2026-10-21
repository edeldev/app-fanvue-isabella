import type { WorkflowTrigger } from "./triggers";

export function subscriptionAutomationTrigger(input: {
  eventType: string;
  wasActive: boolean;
  isActive: boolean;
  hadExpiredSubscription: boolean;
}): WorkflowTrigger | null {
  if (input.eventType === "creator.subscription.activated") {
    if (!input.isActive || input.wasActive) return null;
    return input.hadExpiredSubscription ? "SUBSCRIPTION_REACTIVATED" : "SUBSCRIPTION_ACTIVATED";
  }
  if (input.eventType === "creator.subscription.deactivated") {
    return input.wasActive && !input.isActive ? "SUBSCRIPTION_DEACTIVATED" : null;
  }
  if (input.eventType === "creator.subscription.renewed") return "SUBSCRIPTION_RENEWED";
  return "RENEWAL_CHANGED";
}
