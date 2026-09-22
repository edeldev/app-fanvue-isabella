import { describe, expect, it } from "vitest";
import { analyzeConversationContext, detectCommercialGuard, detectRecentConversationSignals, extractConversationInterests, scoreFanIntelligence, selectNonRepeatedRecommendation } from "./fan-intelligence";

const now = new Date("2026-09-19T12:00:00.000Z");

describe("fan intelligence", () => {
  it("recognizes a high-value fan from confirmed spending", () => {
    const result = scoreFanIntelligence({ totalSpentMinor: 8_500, purchaseCount: 5, tipCount: 2, inboundMessages: 2, outboundMessages: 4, lastInboundAt: now, lastActivityAt: now, isFollower: true, isSubscriber: true, isFreeTrialSubscriber: false, isAutoRenewingSubscriber: true }, now);
    expect(result.segment).toBe("HIGH_VALUE");
    expect(result.valueScore).toBeGreaterThanOrEqual(70);
  });

  it("recognizes an engaged non-payer as high potential", () => {
    const result = scoreFanIntelligence({ totalSpentMinor: 0, purchaseCount: 0, tipCount: 0, inboundMessages: 9, outboundMessages: 7, lastInboundAt: new Date("2026-09-19T10:00:00.000Z"), lastActivityAt: now, isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false, isAutoRenewingSubscriber: false }, now);
    expect(result.segment).toBe("HIGH_POTENTIAL");
    expect(result.readiness).toBe("HOT");
  });

  it("extracts repeated interests without common words", () => {
    expect(extractConversationInterests(["Me gusta mucho el cosplay", "Tienes más cosplay y fotografía?"])).toEqual(["cosplay"]);
  });

  it("detects explicit interests only inside the recent four-day window", () => {
    const signals = detectRecentConversationSignals([
      { text: "Qué bonito bikini, y también me gusta verte sin ropa", sentAt: new Date("2026-09-18T12:00:00.000Z") },
      { text: "Me gustó ese vestido", sentAt: new Date("2026-09-10T12:00:00.000Z") },
    ], now);

    expect(signals.map((signal) => signal.key)).toEqual(["BIKINI", "NUDE"]);
    expect(signals.some((signal) => signal.key === "DRESS")).toBe(false);
  });

  it("does not infer an interest from a generic recent message", () => {
    expect(detectRecentConversationSignals([
      { text: "Hola, cómo estás?", sentAt: new Date("2026-09-19T10:00:00.000Z") },
    ], now)).toEqual([]);
  });

  it("blocks commercial recommendations after a recent rejection", () => {
    expect(detectCommercialGuard([
      { text: "Ahora no quiero comprar nada, gracias", sentAt: new Date("2026-09-19T10:00:00.000Z") },
    ])).toMatchObject({ code: "REJECTION" });
  });

  it("keeps a social conversation in discovery instead of inventing PPV intent", () => {
    const messages = ["Tengo 25 años", "Vivo en Bogotá", "Jajaja, salí con amigas"].map((text, index) => ({
      text,
      sentAt: new Date(now.getTime() - index * 1_000),
    }));

    expect(analyzeConversationContext(messages, [], null).stage).toBe("DISCOVERY");
  });

  it("marks explicit content interest as ready for a contextual offer", () => {
    const messages = [{ text: "Me encanta ese bikini", sentAt: now }];
    const signals = detectRecentConversationSignals(messages, now);

    expect(analyzeConversationContext(messages, signals, null).stage).toBe("OFFER_READY");
  });

  it("does not confuse flirtatious use of después with a request for space", () => {
    const messages = [{
      text: "Tienes un culo perfecto, darle besitos sería una excitación total y te quitaría tus pantys... después tú me dices para dónde sigo",
      sentAt: now,
    }];
    const guard = detectCommercialGuard(messages);
    const signals = detectRecentConversationSignals(messages, now);

    expect(guard).toBeNull();
    expect(signals.map((signal) => signal.key)).toEqual(expect.arrayContaining(["LINGERIE", "EROTIC"]));
    expect(analyzeConversationContext(messages, signals, guard).stage).toBe("OFFER_READY");
  });

  it("chooses a different recommendation when a similar message was already used", () => {
    const candidates = [
      "Muddy, preparé una vista previa especial para ti, ¿quieres verla?",
      "Muddy, guardé un adelanto diferente y quiero saber qué te parece.",
    ];

    expect(selectNonRepeatedRecommendation(candidates, [
      "Muddy preparé una vista previa especial para ti. ¿Quieres verla?",
    ])).toBe(candidates[1]);
  });
});
