export const intelligenceSegments = ["HIGH_VALUE", "MID_VALUE", "HIGH_POTENTIAL", "NURTURE", "AT_RISK"] as const;
export type IntelligenceSegment = (typeof intelligenceSegments)[number];
export type SaleReadiness = "HOT" | "WARM" | "COLD";
export type RecentConversationSignal = {
  key: "BIKINI" | "DRESS" | "LINGERIE" | "NUDE" | "COSPLAY";
  label: string;
  evidence: string;
  detectedAt: Date;
};
export type CommercialGuard = {
  code: "REJECTION" | "NOT_NOW" | "BUDGET_CONCERN";
  label: string;
  evidence: string;
};

export type FanIntelligenceSignals = {
  totalSpentMinor: number;
  purchaseCount: number;
  tipCount: number;
  inboundMessages: number;
  outboundMessages: number;
  lastInboundAt: Date | null;
  lastActivityAt: Date | null;
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isAutoRenewingSubscriber: boolean;
};

export type FanIntelligence = {
  segment: IntelligenceSegment;
  valueScore: number;
  potentialScore: number;
  relationshipScore: number;
  readiness: SaleReadiness;
  reasons: string[];
  nextAction: string;
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const conversationSignalPatterns: Array<{
  key: RecentConversationSignal["key"];
  label: string;
  patterns: RegExp[];
}> = [
  { key: "BIKINI", label: "bikini", patterns: [/\bbikini\b/i, /traje de ba(?:n|ñ)o/i, /\bba(?:n|ñ)ador/i] },
  { key: "DRESS", label: "vestido", patterns: [/\bvestido/i, /\bdress\b/i] },
  { key: "LINGERIE", label: "lencería", patterns: [/lencer[ií]a/i, /\blingerie\b/i, /ropa interior/i] },
  { key: "NUDE", label: "contenido sin ropa", patterns: [/sin ropa/i, /desnud/i, /\bnude\b/i, /\bnaked\b/i] },
  { key: "COSPLAY", label: "cosplay", patterns: [/\bcosplay\b/i, /disfraz/i] },
];

export function scoreFanIntelligence(signals: FanIntelligenceSignals, now = new Date()): FanIntelligence {
  const daysSinceInbound = ageInDays(signals.lastInboundAt, now);
  const daysSinceActivity = ageInDays(signals.lastActivityAt, now);
  const replyRatio = signals.inboundMessages / Math.max(signals.outboundMessages, 1);
  const valueScore = clamp(
    Math.round(
      Math.min(65, signals.totalSpentMinor / 100)
      + Math.min(15, signals.purchaseCount * 4)
      + Math.min(8, signals.tipCount * 4)
      + (signals.isSubscriber && !signals.isFreeTrialSubscriber ? 8 : 0)
      + (signals.isAutoRenewingSubscriber ? 4 : 0),
    ),
  );
  const relationshipScore = clamp(Math.round(
    Math.min(55, signals.inboundMessages * 5)
    + Math.min(20, replyRatio * 12)
    + (daysSinceInbound <= 1 ? 20 : daysSinceInbound <= 7 ? 12 : daysSinceInbound <= 30 ? 5 : 0)
    + (signals.isFollower ? 5 : 0),
  ));
  const lowSpendOpportunity = signals.totalSpentMinor < 2_000 ? 25 : signals.totalSpentMinor < 5_000 ? 12 : 0;
  const accessSignal = signals.isFreeTrialSubscriber ? 18 : signals.isSubscriber ? 10 : signals.isFollower ? 7 : 0;
  const potentialScore = clamp(Math.round(
    relationshipScore * 0.55
    + lowSpendOpportunity
    + accessSignal
    + Math.min(12, signals.inboundMessages * 2),
  ));

  const isDormant = daysSinceActivity > 30;
  const segment: IntelligenceSegment = valueScore >= 70 || signals.totalSpentMinor >= 5_000
    ? "HIGH_VALUE"
    : valueScore >= 28 || signals.totalSpentMinor >= 1_500
      ? "MID_VALUE"
      : potentialScore >= 62 && signals.inboundMessages >= 3
        ? "HIGH_POTENTIAL"
        : isDormant
          ? "AT_RISK"
          : "NURTURE";
  const readiness: SaleReadiness = daysSinceInbound <= 1 && signals.inboundMessages >= 3
    ? "HOT"
    : daysSinceInbound <= 7 && signals.inboundMessages > 0
      ? "WARM"
      : "COLD";

  return {
    segment,
    valueScore,
    potentialScore,
    relationshipScore,
    readiness,
    reasons: intelligenceReasons(signals, readiness),
    nextAction: nextAction(segment, readiness, signals),
  };
}

export function extractConversationInterests(texts: string[], limit = 4) {
  const stopWords = new Set([
    "para", "pero", "porque", "como", "esta", "este", "esto", "hola", "gracias", "quiero", "tienes", "tengo", "eres", "muy", "con", "que", "los", "las", "una", "unos", "unas", "por", "del", "más", "mas", "and", "the", "you", "your", "that", "this", "with", "have", "hello", "thanks",
  ]);
  const counts = new Map<string, number>();
  texts.join(" ").toLocaleLowerCase("es-MX").match(/[\p{L}\p{N}]{4,}/gu)?.forEach((word) => {
    if (!stopWords.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function detectRecentConversationSignals(
  messages: Array<{ text: string | null; sentAt: Date }>,
  now = new Date(),
  windowDays = 4,
) {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const detected = new Map<RecentConversationSignal["key"], RecentConversationSignal>();
  [...messages]
    .filter((message) => message.text?.trim() && message.sentAt.getTime() >= cutoff && message.sentAt <= now)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .forEach((message) => {
      for (const signal of conversationSignalPatterns) {
        if (!detected.has(signal.key) && signal.patterns.some((pattern) => pattern.test(message.text!))) {
          detected.set(signal.key, {
            key: signal.key,
            label: signal.label,
            evidence: message.text!.trim().slice(0, 180),
            detectedAt: message.sentAt,
          });
        }
      }
    });
  return [...detected.values()].slice(0, 3);
}

export function detectCommercialGuard(messages: Array<{ text: string | null; sentAt: Date }>): CommercialGuard | null {
  const newest = [...messages]
    .filter((message) => message.text?.trim())
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, 5);
  const guards: Array<{ code: CommercialGuard["code"]; label: string; patterns: RegExp[] }> = [
    { code: "REJECTION", label: "Rechazó recibir ofertas", patterns: [/no me interesa/i, /no quiero/i, /no gracias/i, /no me mandes/i, /deja de enviar/i, /\bstop\b/i, /not interested/i] },
    { code: "NOT_NOW", label: "Pidió tiempo o espacio", patterns: [/ahora no/i, /quiz[aá]s luego/i, /despu[eé]s/i, /dame tiempo/i, /necesito espacio/i, /estoy ocupad/i, /not now/i, /maybe later/i] },
    { code: "BUDGET_CONCERN", label: "Expresó una objeción de precio", patterns: [/no tengo dinero/i, /no puedo pagar/i, /muy caro/i, /demasiado caro/i, /sin dinero/i, /can'?t afford/i, /too expensive/i] },
  ];
  for (const message of newest) {
    for (const guard of guards) {
      if (guard.patterns.some((pattern) => pattern.test(message.text!))) {
        return { code: guard.code, label: guard.label, evidence: message.text!.trim().slice(0, 180) };
      }
    }
  }
  return null;
}

function intelligenceReasons(signals: FanIntelligenceSignals, readiness: SaleReadiness) {
  const reasons: string[] = [];
  if (signals.totalSpentMinor >= 5_000) reasons.push(`Ha gastado $${(signals.totalSpentMinor / 100).toFixed(2)}.`);
  else if (signals.totalSpentMinor > 0) reasons.push(`Ya realizó ${signals.purchaseCount} compra${signals.purchaseCount === 1 ? "" : "s"}.`);
  else reasons.push("Todavía no registra pagos.");
  if (signals.inboundMessages >= 5) reasons.push(`Ha enviado ${signals.inboundMessages} mensajes recientes: existe conversación real.`);
  if (signals.isFreeTrialSubscriber) reasons.push("Tiene una prueba gratuita activa.");
  else if (signals.isSubscriber) reasons.push("Tiene acceso de suscripción activo.");
  else if (signals.isFollower) reasons.push("Sigue la cuenta, pero aún no tiene acceso activo.");
  if (readiness === "HOT") reasons.push("Respondió recientemente; es un buen momento para conversar, no para presionar.");
  return reasons.slice(0, 4);
}

function nextAction(segment: IntelligenceSegment, readiness: SaleReadiness, signals: FanIntelligenceSignals) {
  if (segment === "HIGH_VALUE") return "Atención VIP: conversa, reconoce su historial y ofrece contenido alineado a compras anteriores.";
  if (segment === "MID_VALUE") return "Profundiza en sus preferencias y presenta una oferta relacionada, sin repetir lo que ya compró.";
  if (segment === "HIGH_POTENTIAL" && readiness === "HOT") return "Continúa la conversación y pide permiso antes de recomendar una suscripción o PPV.";
  if (segment === "HIGH_POTENTIAL") return "Retoma un interés conocido con una pregunta breve antes de vender.";
  if (segment === "AT_RISK") return "Reactivación suave: pregunta cómo está y ofrece valor gratuito antes de una oferta.";
  if (signals.isFreeTrialSubscriber) return "Ayúdale a descubrir el valor de la suscripción antes de que termine su prueba.";
  return "Construye relación: agradece, pregunta qué contenido le interesa y registra su respuesta.";
}

function ageInDays(value: Date | null, now: Date) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - value.getTime()) / DAY_MS);
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
