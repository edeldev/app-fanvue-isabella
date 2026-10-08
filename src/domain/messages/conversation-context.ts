export type ConversationContextMessage = {
  id: string;
  text: string;
  sentAt: Date;
  role: "fan" | "creator";
};

export function pickCurrentConversationContext(messages: ConversationContextMessage[], maximum = 30, gapHours = 12) {
  const ordered = messages
    .filter((message) => message.text.trim())
    .sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime());
  if (!ordered.length) return [];
  const recent = ordered.slice(-Math.max(maximum * 2, maximum));
  let contextStart = 0;
  for (let index = 1; index < recent.length; index += 1) {
    if (recent[index].sentAt.getTime() - recent[index - 1].sentAt.getTime() >= gapHours * 60 * 60_000) contextStart = index;
  }
  return recent.slice(contextStart).slice(-maximum);
}
