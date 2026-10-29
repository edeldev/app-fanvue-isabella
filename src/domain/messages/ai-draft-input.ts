import type { ConversationContextMessage } from "./conversation-context";

export function buildAiDraftInput({
  mode,
  fanName,
  currentDraft,
  currentFanTurn,
  context,
}: {
  mode: "reply" | "improve";
  fanName: string;
  currentDraft?: string;
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
  return {
    task: "reply_to_fan" as const,
    fan: fanName,
    currentFanTurn: currentFanTurn.map((message) => ({ text: message.text, sentAt: message.sentAt.toISOString() })),
    conversation: context.map((message) => ({ speaker: message.role, text: message.text, sentAt: message.sentAt.toISOString() })),
  };
}
