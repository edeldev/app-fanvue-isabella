import { describe, expect, it } from "vitest";
import { calculateNextBestAction, type NextBestActionInput } from "./next-best-action";

const base: NextBestActionInput = {
  name: "Juan",
  lifecycleStage: "FOLLOWER",
  isFollower: true,
  isSubscriber: false,
  isFreeTrialSubscriber: false,
  totalSpentMinor: 0,
  inboundMessages: 0,
  lastInboundAt: null,
  lastOutboundAt: null,
  hasActiveWorkflow: false,
  memories: [],
};

describe("calculateNextBestAction", () => {
  it("recomienda primer contacto sin vender a un seguidor nuevo", () => {
    expect(calculateNextBestAction(base)).toMatchObject({ kind: "FIRST_CONTACT", confidence: 0.97 });
  });

  it("deja el primer contacto en manos del workflow cuando ya está activo", () => {
    expect(calculateNextBestAction({ ...base, hasActiveWorkflow: true })).toMatchObject({
      kind: "FIRST_CONTACT",
      suggestedMessage: null,
    });
  });

  it("no insiste si ya escribió y todavía no obtiene respuesta", () => {
    expect(calculateNextBestAction({ ...base, lastOutboundAt: new Date() })).toMatchObject({
      kind: "WAIT",
      suggestedMessage: null,
    });
  });

  it("prioriza responder un mensaje pendiente", () => {
    expect(calculateNextBestAction({ ...base, inboundMessages: 1, lastInboundAt: new Date(), lastOutboundAt: null }).kind).toBe("REPLY");
  });

  it("nunca recomienda vender si existe un límite", () => {
    expect(calculateNextBestAction({
      ...base,
      memories: [{ category: "BOUNDARY", key: "NOT_NOW", value: "Pidió tiempo", evidence: "Ahora no", confidence: 1 }],
    }).kind).toBe("WAIT");
  });

  it("usa intención explícita antes que una recomendación genérica", () => {
    expect(calculateNextBestAction({
      ...base,
      inboundMessages: 3,
      memories: [{ category: "PURCHASE_INTENT", key: "EXPLICIT_INTEREST", value: "Quiere comprar", evidence: "¿Cuánto cuesta?", confidence: 0.92 }],
    }).kind).toBe("PPV");
  });
});
