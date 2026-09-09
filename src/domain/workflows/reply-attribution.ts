export function isReplyWithinAttributionWindow(
  repliedAt: Date,
  lastMessageAt: Date,
  attributionHours: number,
) {
  const elapsedMs = repliedAt.getTime() - lastMessageAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= attributionHours * 60 * 60 * 1_000;
}
