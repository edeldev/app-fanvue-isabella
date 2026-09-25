import { analyzeConversationContext, detectCommercialGuard, detectRecentConversationSignals } from "./fan-intelligence";

export type MemoryMessage = { id: string; text: string | null; sentAt: Date };
export type FanMemoryCandidate = {
  category: "INTEREST" | "BOUNDARY" | "PURCHASE_INTENT";
  key: string;
  value: string;
  type: "FACT" | "INFERENCE";
  confidence: number;
  evidence: string;
  sourceMessageId: string | null;
  observedAt: Date;
};

export function deriveFanMemory(messages: MemoryMessage[], now = new Date()): FanMemoryCandidate[] {
  const signals = detectRecentConversationSignals(messages, now, 30);
  const guard = detectCommercialGuard(messages);
  const context = analyzeConversationContext(messages, signals, guard);
  const findEvidence = (evidence: string) => messages.find((message) => message.text?.trim().slice(0, 180) === evidence);
  const candidates: FanMemoryCandidate[] = signals.map((signal) => ({
    category: "INTEREST",
    key: signal.key,
    value: signal.label,
    type: "INFERENCE",
    confidence: 0.85,
    evidence: signal.evidence,
    sourceMessageId: findEvidence(signal.evidence)?.id ?? null,
    observedAt: signal.detectedAt,
  }));
  if (guard) {
    const message = findEvidence(guard.evidence);
    candidates.push({
      category: "BOUNDARY",
      key: guard.code,
      value: guard.label,
      type: "FACT",
      confidence: 1,
      evidence: guard.evidence,
      sourceMessageId: message?.id ?? null,
      observedAt: message?.sentAt ?? now,
    });
  }
  if (!guard && context.stage === "OFFER_READY" && signals.length === 0 && context.evidence) {
    const message = findEvidence(context.evidence);
    candidates.push({
      category: "PURCHASE_INTENT",
      key: "EXPLICIT_INTEREST",
      value: "Expresó intención de ver o comprar contenido",
      type: "INFERENCE",
      confidence: 0.92,
      evidence: context.evidence,
      sourceMessageId: message?.id ?? null,
      observedAt: message?.sentAt ?? now,
    });
  }
  return candidates;
}

