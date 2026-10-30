import type { ConversationContextMessage } from "./conversation-context";

export function buildAiDraftInput({
  mode,
  fanName,
  currentDraft,
  previousSuggestions = [],
  responseVariation = 0,
  currentFanTurn,
  context,
}: {
  mode: "reply" | "improve";
  fanName: string;
  currentDraft?: string;
  previousSuggestions?: string[];
  responseVariation?: number;
  currentFanTurn: ConversationContextMessage[];
  context: ConversationContextMessage[];
}) {
  if (mode === "improve") {
    // A rewrite must never be interpreted as a reply to the latest fan turn.
    // Style examples contain only messages the creator actually wrote.
    return {
      task: "rewrite_creator_draft" as const,
      draftToImprove: currentDraft ?? "",
      creatorStyleExamples: context.filter((message) => message.role === "creator").slice(-6).map((message) => message.text),
    };
  }
  const avoidRecentOpenings = [...new Set(
    context
      .filter((message) => message.role === "creator")
      .slice(-8)
      .map((message) => creatorOpening(message.text))
      .filter(Boolean),
  )];
  return {
    task: "reply_to_fan" as const,
    fan: fanName,
    currentFanTurn: currentFanTurn.map((message) => ({ text: message.text, sentAt: message.sentAt.toISOString() })),
    conversation: context.map((message) => ({ speaker: message.role, text: message.text, sentAt: message.sentAt.toISOString() })),
    avoidRecentOpenings,
    avoidPreviousSuggestions: [...new Set(previousSuggestions.map((value) => value.trim()).filter(Boolean))].slice(-4),
    responseVariation,
  };
}

function creatorOpening(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const firstSentence = normalized.split(/(?<=[.!?…])\s/u)[0] ?? normalized;
  return firstSentence.split(" ").slice(0, 6).join(" ").slice(0, 100);
}
