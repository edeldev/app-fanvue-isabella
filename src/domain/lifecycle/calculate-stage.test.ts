import { describe, expect, it } from "vitest";
import { calculateFanLifecycleStage, type FanLifecycleFacts } from "./calculate-stage";

const now = new Date("2026-09-24T12:00:00.000Z");
const base: FanLifecycleFacts = {
  isFollower: true,
  isSubscriber: false,
  isFreeTrialSubscriber: false,
  isNonRenewingSubscriber: false,
  isExpiredSubscriber: false,
  isTopSpender: false,
  totalSpentMinor: 0,
  paidPurchasesCount: 0,
  inboundMessagesCount: 0,
  hasPurchaseIntent: false,
  lastActivityAt: null,
  activeSubscriptionStartedAt: null,
  wasReactivatedRecently: false,
};

describe("calculateFanLifecycleStage", () => {
  it("clasifica un seguidor sin señales posteriores", () => {
    expect(calculateFanLifecycleStage(base, undefined, now).stage).toBe("FOLLOWER");
  });

  it("distingue una prueba gratuita reciente como nuevo suscriptor", () => {
    expect(calculateFanLifecycleStage({
      ...base,
      isSubscriber: true,
      isFreeTrialSubscriber: true,
      activeSubscriptionStartedAt: new Date("2026-09-23T12:00:00.000Z"),
    }, undefined, now).stage).toBe("NEW_SUBSCRIBER");
  });

  it("prioriza el riesgo de no renovación sobre el gasto", () => {
    expect(calculateFanLifecycleStage({
      ...base,
      isSubscriber: true,
      isNonRenewingSubscriber: true,
      totalSpentMinor: 30_000,
    }, undefined, now).stage).toBe("NON_RENEWING");
  });

  it("clasifica comprador recurrente solo por compras pagadas", () => {
    expect(calculateFanLifecycleStage({ ...base, paidPurchasesCount: 2 }, undefined, now).stage)
      .toBe("REPEAT_BUYER");
  });

  it("no marca VIP a un top spender sin gasto confirmado", () => {
    expect(calculateFanLifecycleStage({ ...base, isTopSpender: true, totalSpentMinor: 0 }, undefined, now).stage)
      .toBe("FOLLOWER");
  });

  it("no considera interesado a quien solo conversa sin interés por contenido", () => {
    expect(calculateFanLifecycleStage({
      ...base,
      inboundMessagesCount: 12,
      lastActivityAt: now,
    }, undefined, now).stage).toBe("FOLLOWER");
  });

  it("considera interesado solo si existe una señal de contenido reciente", () => {
    expect(calculateFanLifecycleStage({
      ...base,
      inboundMessagesCount: 1,
      hasPurchaseIntent: true,
      lastActivityAt: now,
    }, undefined, now).stage).toBe("ENGAGED");
  });

  it("clasifica como VIP al alcanzar cien dólares confirmados", () => {
    expect(calculateFanLifecycleStage({ ...base, totalSpentMinor: 10_000 }, undefined, now).stage)
      .toBe("VIP");
  });

  it("no convierte en VIP un top spender que no llega a cien dólares", () => {
    expect(calculateFanLifecycleStage({ ...base, isTopSpender: true, totalSpentMinor: 1_300 }, undefined, now).stage)
      .toBe("FOLLOWER");
  });

  it("clasifica reactivación cuando vuelve tras una suscripción terminada", () => {
    expect(calculateFanLifecycleStage({
      ...base,
      isSubscriber: true,
      wasReactivatedRecently: true,
      activeSubscriptionStartedAt: now,
    }, undefined, now).stage).toBe("REACTIVATED");
  });
});
