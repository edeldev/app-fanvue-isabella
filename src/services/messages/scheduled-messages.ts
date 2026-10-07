import type { Prisma } from "@prisma/client";
import { fanvueRequest } from "@/lib/fanvue/client";
import { sentMessageSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/logger";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

type ScheduledMedia = { uuid: string; name: string; mediaType: "image" | "video" };

function readMedia(value: Prisma.JsonValue | null): ScheduledMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return typeof record.uuid === "string" && typeof record.name === "string" && (record.mediaType === "image" || record.mediaType === "video")
      ? [{ uuid: record.uuid, name: record.name, mediaType: record.mediaType }]
      : [];
  });
}

export async function runDueScheduledMessages(now = new Date()) {
  const staleClaim = new Date(now.getTime() - 5 * 60_000);
  const due = await prisma.scheduledMessage.findMany({
    where: {
      scheduledAt: { lte: now },
      OR: [{ status: "PENDING" }, { status: "SENDING", updatedAt: { lt: staleClaim } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: 30,
    select: { id: true },
  });
  const result = { claimed: 0, sent: 0, blocked: 0, retrying: 0, failed: 0 };
  for (const candidate of due) {
    const claimed = await prisma.scheduledMessage.updateMany({
      where: { id: candidate.id, OR: [{ status: "PENDING" }, { status: "SENDING", updatedAt: { lt: staleClaim } }] },
      data: { status: "SENDING", attempts: { increment: 1 }, lastError: null },
    });
    if (!claimed.count) continue;
    result.claimed += 1;
    const item = await prisma.scheduledMessage.findUnique({
      where: { id: candidate.id },
      include: { fan: true, template: { select: { id: true, status: true } } },
    });
    if (!item) continue;
    if (item.fan.doNotMessage || item.fan.isCreatorAccount || (item.template?.status && item.template.status !== "ACTIVE")) {
      await prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "BLOCKED", lastError: item.fan.doNotMessage ? "FAN_DO_NOT_MESSAGE" : "RECIPIENT_OR_TEMPLATE_UNAVAILABLE" } });
      result.blocked += 1;
      continue;
    }
    try {
      const media = readMedia(item.media);
      const lockedMedia = item.mediaPreviewUuid ? media.filter((entry) => entry.uuid !== item.mediaPreviewUuid) : media;
      const token = await getValidFanvueAccessToken(item.creatorId);
      const sent = await fanvueRequest(`/v1/chats/${item.fan.fanvueUserId}/message`, token, sentMessageSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text || null, mediaUuids: lockedMedia.map((entry) => entry.uuid), mediaPreviewUuid: item.mediaPreviewUuid, price: item.priceMinor }),
      });
      const conversation = await prisma.conversation.upsert({
        where: { creatorId_fanId: { creatorId: item.creatorId, fanId: item.fanId } },
        update: { lastMessageAt: now, lastOutboundAt: now },
        create: { creatorId: item.creatorId, fanId: item.fanId, lastMessageAt: now, lastOutboundAt: now },
      });
      await prisma.$transaction([
        prisma.message.upsert({
          where: { creatorId_fanvueMessageId: { creatorId: item.creatorId, fanvueMessageId: sent.messageUuid } },
          update: { text: item.text, templateId: item.templateId, status: "SENT", mediaUuids: media.map((entry) => entry.uuid), mediaPreviewUuid: item.mediaPreviewUuid, priceMinor: item.priceMinor },
          create: { creatorId: item.creatorId, conversationId: conversation.id, fanvueMessageId: sent.messageUuid, templateId: item.templateId, direction: "OUTBOUND", status: "SENT", text: item.text, mediaUuids: media.map((entry) => entry.uuid), mediaPreviewUuid: item.mediaPreviewUuid, priceMinor: item.priceMinor, sentAt: now },
        }),
        prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "SENT", sentAt: now, fanvueMessageId: sent.messageUuid, lastError: null } }),
      ]);
      result.sent += 1;
    } catch (error) {
      const lastError = sanitizeErrorMessage(error instanceof Error ? error.message : "Error desconocido").slice(0, 500);
      const retry = item.attempts < 3;
      await prisma.scheduledMessage.update({
        where: { id: item.id },
        data: retry
          ? { status: "PENDING", scheduledAt: new Date(now.getTime() + Math.max(1, item.attempts) * 5 * 60_000), lastError }
          : { status: "FAILED", lastError },
      });
      if (retry) result.retrying += 1;
      else result.failed += 1;
    }
  }
  return result;
}
