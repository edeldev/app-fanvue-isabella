export const engagementEventTypes = [
  "FOLLOW_CREATED",
  "POST_LIKED",
  "POST_COMMENTED",
  "MESSAGE_RECEIVED",
] as const;

export type EngagementEventType = (typeof engagementEventTypes)[number];

export type EngagementNotificationView = {
  id: string;
  type: EngagementEventType;
  title: string;
  message: string;
  actorName: string;
  actorUsername: string | null;
  avatarUrl: string | null;
  postUuid: string | null;
  fanUuid: string | null;
  occurredAt: string;
  createdAt: string;
};

export function notificationPreview(value: string, maximum = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

export function engagementCopy(
  type: EngagementEventType,
  actorName: string,
  payload: unknown,
) {
  const metadata = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const comment = typeof metadata.commentText === "string" ? metadata.commentText.trim() : "";

  if (type === "FOLLOW_CREATED") {
    return { title: "Nuevo seguidor", message: `${actorName} comenzó a seguirte.` };
  }
  if (type === "POST_LIKED") {
    return { title: "Nuevo me gusta", message: `${actorName} dio me gusta a tu publicación.` };
  }
  if (type === "MESSAGE_RECEIVED") {
    const text = typeof metadata.text === "string" ? metadata.text.trim() : "";
    return { title: "Nuevo mensaje", message: text ? notificationPreview(`${actorName}: ${text}`) : `${actorName} te envió un mensaje.` };
  }
  return {
    title: "Nuevo comentario",
    message: comment ? notificationPreview(`${actorName}: ${comment}`) : `${actorName} comentó tu publicación.`,
  };
}
