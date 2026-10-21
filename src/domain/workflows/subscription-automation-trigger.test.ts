import { describe, expect, it } from "vitest";
import { subscriptionAutomationTrigger } from "./subscription-automation-trigger";

describe("subscriptionAutomationTrigger", () => {
  it("starts the first-subscription funnel for a new active subscription", () => {
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.activated", wasActive: false, isActive: true, hadExpiredSubscription: false })).toBe("SUBSCRIPTION_ACTIVATED");
  });

  it("routes a real return after expiration to a different funnel", () => {
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.activated", wasActive: false, isActive: true, hadExpiredSubscription: true })).toBe("SUBSCRIPTION_REACTIVATED");
  });

  it("does not restart either funnel for duplicate activation or deactivation events", () => {
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.activated", wasActive: true, isActive: true, hadExpiredSubscription: true })).toBeNull();
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.deactivated", wasActive: false, isActive: false, hadExpiredSubscription: true })).toBeNull();
  });

  it("starts expiration only when access actually ends", () => {
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.deactivated", wasActive: true, isActive: false, hadExpiredSubscription: false })).toBe("SUBSCRIPTION_DEACTIVATED");
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.deactivated", wasActive: true, isActive: true, hadExpiredSubscription: false })).toBeNull();
  });

  it("keeps ordinary renewals distinct from returns", () => {
    expect(subscriptionAutomationTrigger({ eventType: "creator.subscription.renewed", wasActive: true, isActive: true, hadExpiredSubscription: true })).toBe("SUBSCRIPTION_RENEWED");
  });
});
