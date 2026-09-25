import type { FanLifecycleStage } from "@prisma/client";

export type FanLifecycleFacts = {
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isNonRenewingSubscriber: boolean;
  isExpiredSubscriber: boolean;
  isTopSpender: boolean;
  totalSpentMinor: number;
  paidPurchasesCount: number;
  inboundMessagesCount: number;
  lastActivityAt: Date | null;
  activeSubscriptionStartedAt: Date | null;
  wasReactivatedRecently: boolean;
};

export type FanLifecycleRules = {
  newSubscriberDays: number;
  engagedWithinDays: number;
  engagedMessageCount: number;
  highValueMinor: number;
  vipValueMinor: number;
};

export const DEFAULT_LIFECYCLE_RULES: FanLifecycleRules = {
  newSubscriberDays: 7,
  engagedWithinDays: 30,
  engagedMessageCount: 3,
  highValueMinor: 5_000,
  vipValueMinor: 10_000,
};

const withinDays = (value: Date | null, days: number, now: Date) =>
  Boolean(value && now.getTime() - value.getTime() <= days * 86_400_000);

export function calculateFanLifecycleStage(
  facts: FanLifecycleFacts,
  rules: FanLifecycleRules = DEFAULT_LIFECYCLE_RULES,
  now = new Date(),
): { stage: FanLifecycleStage; reason: string } {
  if (facts.isSubscriber && facts.isNonRenewingSubscriber) {
    return { stage: "NON_RENEWING", reason: "Tiene acceso activo, pero la renovación automática está desactivada." };
  }

  if (!facts.isSubscriber && facts.isExpiredSubscriber) {
    return { stage: "EXPIRED", reason: "Su acceso de suscripción terminó y todavía no se ha reactivado." };
  }

  if (facts.isSubscriber && facts.wasReactivatedRecently) {
    return { stage: "REACTIVATED", reason: "Volvió a tener una suscripción activa después de una suscripción terminada." };
  }

  if ((facts.isTopSpender && facts.totalSpentMinor > 0) || facts.totalSpentMinor >= rules.vipValueMinor) {
    return { stage: "VIP", reason: "Alcanzó el nivel VIP por gasto confirmado o clasificación de top spender." };
  }

  if (facts.totalSpentMinor >= rules.highValueMinor) {
    return { stage: "HIGH_VALUE", reason: "Su gasto confirmado alcanzó el umbral de alto valor." };
  }

  if (facts.paidPurchasesCount >= 2) {
    return { stage: "REPEAT_BUYER", reason: "Tiene dos o más compras pagadas y no revertidas." };
  }

  if (facts.paidPurchasesCount === 1) {
    return { stage: "FIRST_BUYER", reason: "Realizó su primera compra pagada y no revertida." };
  }

  if (facts.isSubscriber && withinDays(facts.activeSubscriptionStartedAt, rules.newSubscriberDays, now)) {
    return {
      stage: "NEW_SUBSCRIBER",
      reason: facts.isFreeTrialSubscriber
        ? "Inició recientemente una suscripción de prueba gratuita."
        : "Inició recientemente una suscripción activa.",
    };
  }

  if (
    facts.inboundMessagesCount >= rules.engagedMessageCount &&
    withinDays(facts.lastActivityAt, rules.engagedWithinDays, now)
  ) {
    return { stage: "ENGAGED", reason: "Ha conversado y mostrado actividad recientemente." };
  }

  return {
    stage: "FOLLOWER",
    reason: facts.isFollower
      ? "Sigue la cuenta, pero aún no presenta una señal posterior del ciclo de vida."
      : "Contacto conocido sin una señal posterior del ciclo de vida.",
  };
}
