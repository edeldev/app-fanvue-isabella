import type { FanLifecycleStage } from "@prisma/client";

export type NextBestActionKind = "FIRST_CONTACT" | "REPLY" | "WAIT" | "DISCOVER" | "SUBSCRIPTION" | "PPV" | "RETENTION" | "REACTIVATION";
export type NextBestActionInput = {
  name: string;
  lifecycleStage: FanLifecycleStage;
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  totalSpentMinor: number;
  inboundMessages: number;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  hasActiveWorkflow: boolean;
  memories: Array<{ category: string; key: string; value: string; evidence: string | null; confidence: number }>;
};
export type NextBestAction = {
  kind: NextBestActionKind;
  title: string;
  reason: string;
  confidence: number;
  evidence: string[];
  suggestedMessage: string | null;
};

export function calculateNextBestAction(input: NextBestActionInput): NextBestAction {
  const name = input.name || "Hola";
  const boundary = input.memories.find((memory) => memory.category === "BOUNDARY");
  const interest = input.memories.find((memory) => memory.category === "INTEREST");
  const purchaseIntent = input.memories.find((memory) => memory.category === "PURCHASE_INTENT");
  const unanswered = Boolean(input.lastInboundAt && (!input.lastOutboundAt || input.lastInboundAt > input.lastOutboundAt));
  const memoryEvidence = (memory: typeof boundary) => memory?.evidence ? [`“${memory.evidence}”`] : [];

  if (boundary) return {
    kind: "WAIT",
    title: "Esperar y respetar su límite",
    reason: boundary.value,
    confidence: 1,
    evidence: memoryEvidence(boundary),
    suggestedMessage: null,
  };
  if (unanswered) return {
    kind: "REPLY",
    title: "Responder antes de automatizar",
    reason: "El último mensaje fue del fan y todavía no tiene respuesta.",
    confidence: 0.98,
    evidence: ["Existe un mensaje entrante posterior al último mensaje enviado."],
    suggestedMessage: null,
  };
  if (input.lifecycleStage === "NON_RENEWING") return {
    kind: "RETENTION",
    title: "Entender por qué no renovará",
    reason: "Conserva acceso activo, pero la renovación automática está apagada.",
    confidence: 0.95,
    evidence: ["Estado actual: no renovará."],
    suggestedMessage: `${name}, antes de que termine tu acceso quería preguntarte algo rápido 😊 ¿qué te gustaría encontrar aquí para que realmente valga la pena para ti?`,
  };
  if (input.lifecycleStage === "EXPIRED") return {
    kind: "REACTIVATION",
    title: "Reactivar sin comenzar con una venta",
    reason: "Su acceso terminó; primero conviene recuperar la conversación.",
    confidence: 0.9,
    evidence: ["La suscripción figura como vencida."],
    suggestedMessage: `${name}, hace tiempo que no hablamos 😊 me dio curiosidad saber cómo has estado y qué te gustaría ver de mí ahora.`,
  };
  if (purchaseIntent) return {
    kind: "PPV",
    title: "Preparar una oferta relacionada",
    reason: "Expresó intención explícita de ver o comprar contenido.",
    confidence: purchaseIntent.confidence,
    evidence: memoryEvidence(purchaseIntent),
    suggestedMessage: interest
      ? `${name}, tengo algo relacionado con ${interest.value} que creo que encaja contigo 👀 ¿quieres ver primero una pequeña vista previa?`
      : `${name}, tengo algo que creo que puede gustarte 👀 ¿quieres ver primero una pequeña vista previa?`,
  };
  if (input.inboundMessages === 0 && input.isFollower && !input.lastOutboundAt) return {
    kind: "FIRST_CONTACT",
    title: "Iniciar el primer contacto",
    reason: input.hasActiveWorkflow
      ? "Es un seguidor sin conversación; ya tiene un workflow que puede encargarse de la bienvenida."
      : "Es un seguidor sin conversación ni workflow activo.",
    confidence: 0.97,
    evidence: ["No existen mensajes recibidos de este fan.", input.hasActiveWorkflow ? "Tiene un workflow activo." : "No tiene un workflow activo."],
    suggestedMessage: input.hasActiveWorkflow
      ? null
      : `${name}, gracias por seguirme 😊 me gustaría conocerte un poquito: ¿qué tipo de contenido disfrutas más ver por aquí?`,
  };
  if (input.inboundMessages === 0 && input.lastOutboundAt) return {
    kind: "WAIT",
    title: "Esperar su respuesta",
    reason: "Ya recibió un mensaje y todavía no ha respondido; enviar otro ahora podría sentirse insistente.",
    confidence: 0.92,
    evidence: ["Existe un mensaje enviado y ningún mensaje recibido."],
    suggestedMessage: null,
  };
  if (interest && ["FIRST_BUYER", "REPEAT_BUYER", "HIGH_VALUE", "VIP"].includes(input.lifecycleStage)) return {
    kind: "PPV",
    title: "Validar interés antes del siguiente PPV",
    reason: `Ya compra y existe una preferencia detectada por ${interest.value}.`,
    confidence: Math.min(0.94, interest.confidence),
    evidence: [...memoryEvidence(interest), `Gasto confirmado: $${(input.totalSpentMinor / 100).toFixed(2)}.`],
    suggestedMessage: `${name}, me acordé de que te llamó la atención ${interest.value} 👀 estoy preparando algo por esa línea. ¿Te gustaría que te enseñe una vista previa cuando esté listo?`,
  };
  if (input.isFreeTrialSubscriber) return {
    kind: "SUBSCRIPTION",
    title: "Mostrar valor durante la prueba",
    reason: "Tiene una prueba activa; conviene descubrir qué valora antes de hablar de renovar.",
    confidence: 0.88,
    evidence: ["La suscripción actual es una prueba gratuita."],
    suggestedMessage: `${name}, quiero que aproveches bien tu acceso 😊 ¿qué te gustaría descubrir primero: algo más espontáneo o algo más producido?`,
  };
  return {
    kind: "DISCOVER",
    title: "Conocer mejor sus preferencias",
    reason: interest ? `Existe interés en ${interest.value}, pero todavía no hay una señal reciente para vender.` : "Todavía falta contexto confiable para recomendar una oferta.",
    confidence: interest ? 0.78 : 0.7,
    evidence: interest ? memoryEvidence(interest) : ["No existe intención de compra explícita activa."],
    suggestedMessage: interest
      ? `${name}, me quedé pensando en que te gusta ${interest.value} 😊 ¿qué parte es la que más te llama la atención?`
      : `${name}, quiero conocerte mejor 😊 ¿qué tipo de contenido disfrutas más ver por aquí?`,
  };
}
