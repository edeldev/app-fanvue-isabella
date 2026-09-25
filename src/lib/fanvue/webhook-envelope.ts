export function creatorUuidFromWebhookData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const creator = (data as Record<string, unknown>).creator;
  if (!creator || typeof creator !== "object" || Array.isArray(creator)) return null;
  const uuid = (creator as Record<string, unknown>).uuid;
  return typeof uuid === "string" && uuid.length > 0 ? uuid : null;
}

