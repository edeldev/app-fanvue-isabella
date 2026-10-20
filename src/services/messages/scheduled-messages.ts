import type { Prisma } from "@prisma/client";
import { fanvueRequest } from "@/lib/fanvue/client";
import { sentMessageSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/logger";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";
import { canReceivePaidOrIntimateContent, canReceiveMessageMedia } from "@/domain/fans/content-consent";
import { FanvueError } from "@/lib/fanvue/errors";
import { reserveAutomatedSendBudget } from "@/services/messages/automated-send-budget";
import { mandatoryAutomatedSendLimits } from "@/domain/messages/mandatory-send-limits";
import { assertSendRecipient, SendRecipientIneligibleError } from "@/services/messages/assert-send-recipient";
import { prepareOutboundMediaText } from "@/domain/messages/media-disclosure";

type ScheduledMedia = { uuid: string; name: string; mediaType: "image" | "video"; sfwAttested: boolean; mediaOrigin: "original" | "ai_generated" | null };

function readMedia(value: Prisma.JsonValue | null): ScheduledMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return typeof record.uuid === "string" && typeof record.name === "string" && (record.mediaType === "image" || record.mediaType === "video")
      ? [{ uuid: record.uuid, name: record.name, mediaType: record.mediaType, sfwAttested: record.sfwAttested === true, mediaOrigin: record.mediaOrigin === "original" || record.mediaOrigin === "ai_generated" ? record.mediaOrigin : null }]
      : [];
  });
}

export async function runDueScheduledMessages(now = new Date()) {
  const staleClaim = new Date(now.getTime() - 5 * 60_000);
  // A crashed worker may have already delivered the message to Fanvue.
  // Never resend an ambiguous delivery automatically.
  await prisma.scheduledMessage.updateMany({
    where: { status: "SENDING", updatedAt: { lt: staleClaim } },
    data: { status: "NEEDS_REVIEW", lastError: "DELIVERY_STATUS_UNKNOWN_CHECK_FANVUE" },
  });
  const due = await prisma.scheduledMessage.findMany({
    where: {
      scheduledAt: { lte: now },
      status: "PENDING",
    },
    orderBy: { scheduledAt: "asc" },
    take: 30,
    select: { id: true },
  });
  const result = { claimed: 0, sent: 0, blocked: 0, retrying: 0, failed: 0 };
  for (const candidate of due) {
    const claimed = await prisma.scheduledMessage.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 }, lastError: null },
    });
    if (!claimed.count) continue;
    result.claimed += 1;
    const item = await prisma.scheduledMessage.findUnique({
      where: { id: candidate.id },
      include: { fan: true, template: { select: { id: true, status: true } }, creator: { select: { settings: { select: { aiProfileLabelConfirmed: true, sendLimitsEnabled: true, maxMessagesPerHour: true, maxMessagesPerDay: true, minMinutesBetweenFanMessages: true } } } } },
    });
    if (!item) continue;
    if (item.fan.doNotMessage || item.fan.isCreatorAccount || (item.template?.status && item.template.status !== "ACTIVE")) {
      await prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "BLOCKED", lastError: item.fan.doNotMessage ? "FAN_DO_NOT_MESSAGE" : "RECIPIENT_OR_TEMPLATE_UNAVAILABLE" } });
      result.blocked += 1;
      continue;
    }
    const scheduledMedia = readMedia(item.media);
    let sendText: string;
    try {
      sendText = prepareOutboundMediaText(item.text ?? "", scheduledMedia[0]?.mediaOrigin, scheduledMedia.length, item.creator.settings?.aiProfileLabelConfirmed === true);
      if (sendText.length > 5000) throw new Error("MESSAGE_TOO_LONG");
    } catch (error) {
      await prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "BLOCKED", lastError: error instanceof Error && error.message === "MESSAGE_TOO_LONG" ? "MESSAGE_TOO_LONG" : "MEDIA_ORIGIN_REQUIRED" } });
      result.blocked += 1;
      continue;
    }
    const mediaSafety = item.priceMinor === null && scheduledMedia.length > 0 && scheduledMedia.every((entry) => entry.sfwAttested) ? "SFW" : "UNREVIEWED";
    if ((item.priceMinor !== null && !canReceivePaidOrIntimateContent(item.fan)) || !canReceiveMessageMedia(item.fan, scheduledMedia.length, mediaSafety)) {
      await prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "BLOCKED", lastError: "EXPLICIT_CONTENT_OPT_IN_REQUIRED" } });
      result.blocked += 1;
      continue;
    }
    const budget = await reserveAutomatedSendBudget({ creatorId: item.creatorId, fanId: item.fanId, limits: mandatoryAutomatedSendLimits(item.creator.settings), now });
    if (!budget.allowed) {
      await prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "PENDING", scheduledAt: budget.nextRunAt, lastError: budget.reasonCode } });
      result.retrying += 1;
      continue;
    }
    try {
      const media = scheduledMedia;
      const lockedMedia = item.mediaPreviewUuid ? media.filter((entry) => entry.uuid !== item.mediaPreviewUuid) : media;
      const token = await getValidFanvueAccessToken(item.creatorId);
      await assertSendRecipient(item.creatorId, item.fanId, media.length, item.priceMinor !== null, mediaSafety);
      const sent = await fanvueRequest(`/v1/chats/${item.fan.fanvueUserId}/message`, token, sentMessageSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sendText || null, mediaUuids: lockedMedia.map((entry) => entry.uuid), mediaPreviewUuid: item.mediaPreviewUuid, price: item.priceMinor }),
      });
      const conversation = await prisma.conversation.upsert({
        where: { creatorId_fanId: { creatorId: item.creatorId, fanId: item.fanId } },
        update: { lastMessageAt: now, lastOutboundAt: now },
        create: { creatorId: item.creatorId, fanId: item.fanId, lastMessageAt: now, lastOutboundAt: now },
      });
      await prisma.$transaction([
        prisma.message.upsert({
          where: { creatorId_fanvueMessageId: { creatorId: item.creatorId, fanvueMessageId: sent.messageUuid } },
          update: { text: sendText, templateId: item.templateId, status: "SENT", mediaUuids: media.map((entry) => entry.uuid), mediaPreviewUuid: item.mediaPreviewUuid, priceMinor: item.priceMinor },
          create: { creatorId: item.creatorId, conversationId: conversation.id, fanvueMessageId: sent.messageUuid, templateId: item.templateId, direction: "OUTBOUND", status: "SENT", text: sendText, mediaUuids: media.map((entry) => entry.uuid), mediaPreviewUuid: item.mediaPreviewUuid, priceMinor: item.priceMinor, sentAt: now },
        }),
        prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "SENT", sentAt: now, fanvueMessageId: sent.messageUuid, lastError: null } }),
      ]);
      result.sent += 1;
    } catch (error) {
      if (error instanceof SendRecipientIneligibleError) {
        await prisma.scheduledMessage.update({ where: { id: item.id }, data: { status: "BLOCKED", lastError: error.code } });
        result.blocked += 1;
        continue;
      }
      const lastError = sanitizeErrorMessage(error instanceof Error ? error.message : "Error desconocido").slice(0, 500);
      const rateLimited = error instanceof FanvueError && error.status === 429;
      const permanentFailure = error instanceof FanvueError && [400, 401, 403, 404, 410, 422].includes(error.status);
      const retrySeconds = rateLimited
        ? Math.max(60, Number.isFinite(error.retryAfterSeconds) ? error.retryAfterSeconds ?? 60 : 60)
        : 0;
      await prisma.scheduledMessage.update({
        where: { id: item.id },
        data: rateLimited
          ? { status: "PENDING", scheduledAt: new Date(now.getTime() + retrySeconds * 1_000), lastError }
          : { status: permanentFailure ? "FAILED" : "NEEDS_REVIEW", lastError: permanentFailure ? lastError : `DELIVERY_STATUS_UNKNOWN_CHECK_FANVUE: ${lastError}` },
      });
      if (rateLimited) result.retrying += 1;
      else result.failed += 1;
    }
  }
  return result;
}
