export type AttentionPriority = "URGENT" | "TODAY" | "SOON";

export type AttentionSignals = {
  unreadMessages: number;
  totalSpentMinor: number;
  inboundMessages: number;
  outboundMessages: number;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  lastActivityAt: Date | null;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isNonRenewingSubscriber: boolean;
  trialEndsAt: Date | null;
};

export type AttentionRecommendation = {
  score: number;
  priority: AttentionPriority;
  reason: string;
  action: string;
} | null;

const DAY_MS = 24 * 60 * 60 * 1_000;

export function prioritizeFanAttention(
  signals: AttentionSignals,
  now = new Date(),
): AttentionRecommendation {
  const hasUnansweredMessage = signals.unreadMessages > 0
    || Boolean(
      signals.lastInboundAt
      && (!signals.lastOutboundAt || signals.lastInboundAt > signals.lastOutboundAt),
    );
  const daysUntilTrialEnds = signals.trialEndsAt
    ? (signals.trialEndsAt.getTime() - now.getTime()) / DAY_MS
    : Number.POSITIVE_INFINITY;
  const daysSinceActivity = signals.lastActivityAt
    ? Math.max(0, (now.getTime() - signals.lastActivityAt.getTime()) / DAY_MS)
    : Number.POSITIVE_INFINITY;
  const valueBonus = Math.min(25, Math.floor(signals.totalSpentMinor / 2_000) * 5);

  if (hasUnansweredMessage) {
    return {
      score: 100 + Math.min(20, signals.unreadMessages * 3) + valueBonus,
      priority: "URGENT",
      reason: signals.unreadMessages > 1
        ? `${signals.unreadMessages} mensajes esperan respuesta`
        : "Tiene un mensaje esperando respuesta",
      action: "Responder ahora mientras la conversación está activa.",
    };
  }

  if (signals.isFreeTrialSubscriber && daysUntilTrialEnds >= 0 && daysUntilTrialEnds <= 3) {
    const days = Math.max(1, Math.ceil(daysUntilTrialEnds));
    return {
      score: 85 - Math.floor(daysUntilTrialEnds * 5),
      priority: "TODAY",
      reason: daysUntilTrialEnds < 1 ? "Su prueba gratuita termina hoy" : `Su prueba termina en ${days} días`,
      action: "Conectar y mostrar valor antes de sugerir la suscripción.",
    };
  }

  if (signals.isSubscriber && signals.isNonRenewingSubscriber) {
    return {
      score: 72 + valueBonus,
      priority: "TODAY",
      reason: "Tiene acceso activo, pero no renovará",
      action: "Entender la objeción antes de ofrecer una renovación.",
    };
  }

  const engagedWithoutPurchase = signals.totalSpentMinor < 2_000
    && signals.inboundMessages >= 3
    && daysSinceActivity <= 7;
  if (engagedWithoutPurchase) {
    return {
      score: 58 + Math.min(12, signals.inboundMessages),
      priority: "SOON",
      reason: "Conversación activa con potencial de conversión",
      action: "Retomar su interés y pedir permiso antes de recomendar contenido.",
    };
  }

  if (signals.totalSpentMinor >= 5_000 && daysSinceActivity <= 14) {
    return {
      score: 48 + valueBonus,
      priority: "SOON",
      reason: "Fan de alto valor con actividad reciente",
      action: "Dar seguimiento VIP con contexto de sus compras anteriores.",
    };
  }

  return null;
}
