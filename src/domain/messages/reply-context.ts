export type LocalReplyContext = {
  sender: string;
  excerpt: string;
  body: string;
};

export function parseLocalReplyContext(text: string | null | undefined): LocalReplyContext | null {
  if (!text) return null;
  const normalized = text.replace(/\r\n?/g, "\n");
  const separator = normalized.indexOf("\n\n");
  if (separator < 0) return null;
  const header = normalized.slice(0, separator).trim();
  const body = normalized.slice(separator + 2).trimStart();
  const match = header.match(/^[↪↩→]\s+([^:\n]{1,80}):\s*([\s\S]{1,240})$/);
  return match && body
    ? { sender: match[1].trim(), excerpt: match[2].trim(), body }
    : null;
}

export function buildLocalReplyText(sender: string, excerpt: string, body: string) {
  const safeSender = sender.replace(/\s+/g, " ").trim().slice(0, 80);
  const safeExcerpt = excerpt.replace(/\s+/g, " ").trim().slice(0, 240);
  return safeSender && safeExcerpt && body
    ? `↪ ${safeSender}: ${safeExcerpt}\n\n${body}`
    : body;
}

export function preserveLocalReplyText(localText: string | null | undefined, providerText: string | null | undefined) {
  const localReply = parseLocalReplyContext(localText);
  if (!localReply) return providerText ?? null;
  return localReply.body.trim() === (providerText ?? "").trim()
    ? localText ?? null
    : providerText ?? null;
}
