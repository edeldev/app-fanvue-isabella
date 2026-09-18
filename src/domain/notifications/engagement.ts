export const engagementEventTypes = [
  "FOLLOW_CREATED",
  "POST_LIKED",
  "POST_COMMENTED",
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
  occurredAt: string;
  createdAt: string;
};

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
  return {
    title: "Nuevo comentario",
    message: comment ? `${actorName}: ${comment}` : `${actorName} comentó tu publicación.`,
  };
}
