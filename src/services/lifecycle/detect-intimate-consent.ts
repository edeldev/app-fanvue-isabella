import { Prisma } from "@prisma/client";
import { detectIntimateContentConsent } from "@/domain/fans/intimate-consent-detection";
import { prisma } from "@/lib/prisma";
import { scheduledMediaIsNsfw } from "@/domain/messages/scheduled-content-rating";

export async function detectAndRecordIntimateConsent(
  creatorId: string,
  fanId: string,
  conversationId: string,
  incomingMessageId: string,
) {
  const messages = await prisma.message.findMany({
    where: { creatorId, conversationId, deletedAt: null },
    orderBy: { sentAt: "desc" },
    take: 20,
    select: { id: true, direction: true, text: true, sentAt: true },
  });
  const detection = detectIntimateContentConsent(
    messages.map((message) => ({
      id: message.id,
      role: message.direction === "INBOUND" ? "fan" as const : "creator" as const,
      text: message.text,
      sentAt: message.sentAt,
    })),
    incomingMessageId,
  );
  if (detection.decision !== "GRANTED" && detection.decision !== "REVOKED") return detection;

  const fan = await prisma.fan.findFirst({
    where: { id: fanId, creatorId },
    select: { intimateContentOptIn: true, intimateContentOptInSource: true },
  });
  if (!fan) return detection;
  const granted = detection.decision === "GRANTED";
  const source = granted ? `fanvue-message:${incomingMessageId}` : null;
  if (fan.intimateContentOptIn === granted && fan.intimateContentOptInSource === source) return detection;

  const occurredAt = messages.find((message) => message.id === incomingMessageId)?.sentAt ?? new Date();
  const payload: Prisma.InputJsonObject = {
    automatic: true,
    evidenceMessageId: incomingMessageId,
    reason: detection.reason,
  };
  const pendingNsfwIds = granted ? [] : (await prisma.scheduledMessage.findMany({
    where: { creatorId, fanId, status: "PENDING" },
    select: { id: true, media: true },
  })).filter((message) => scheduledMediaIsNsfw(message.media)).map((message) => message.id);
  await prisma.$transaction([
    prisma.fan.update({
      where: { id: fanId },
      data: {
        intimateContentOptIn: granted,
        intimateContentOptInAt: granted ? occurredAt : null,
        intimateContentOptOutAt: granted ? null : occurredAt,
        intimateContentOptInSource: source,
      },
    }),
    prisma.fanEvent.upsert({
      where: { creatorId_externalEventId: { creatorId, externalEventId: `intimate-consent:${incomingMessageId}` } },
      update: { fanId, type: granted ? "INTIMATE_CONTENT_OPT_IN" : "INTIMATE_CONTENT_OPT_OUT", occurredAt, payload },
      create: {
        creatorId,
        fanId,
        externalEventId: `intimate-consent:${incomingMessageId}`,
        type: granted ? "INTIMATE_CONTENT_OPT_IN" : "INTIMATE_CONTENT_OPT_OUT",
        occurredAt,
        payload,
      },
    }),
    ...(pendingNsfwIds.length ? [prisma.scheduledMessage.updateMany({ where: { id: { in: pendingNsfwIds }, status: "PENDING" }, data: { status: "BLOCKED", lastError: "INTIMATE_CONTENT_CONSENT_REVOKED" } })] : []),
  ]);
  return detection;
}

export async function reconcileRecentIntimateConsent(creatorId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { creatorId, messages: { some: { direction: "INBOUND", text: { not: null }, deletedAt: null } } },
    orderBy: { lastMessageAt: "desc" },
    take: 250,
    select: {
      id: true,
      fanId: true,
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "desc" },
        take: 20,
        select: { id: true, direction: true, text: true, sentAt: true },
      },
    },
  });
  let reconciled = 0;
  for (const conversation of conversations) {
    const context = conversation.messages.map((message) => ({
      id: message.id,
      role: message.direction === "INBOUND" ? "fan" as const : "creator" as const,
      text: message.text,
      sentAt: message.sentAt,
    }));
    const newestDecision = conversation.messages
      .filter((message) => message.direction === "INBOUND")
      .map((message) => ({ message, detection: detectIntimateContentConsent(context, message.id) }))
      .find(({ detection }) => detection.decision === "GRANTED" || detection.decision === "REVOKED");
    if (!newestDecision) continue;
    await detectAndRecordIntimateConsent(creatorId, conversation.fanId, conversation.id, newestDecision.message.id);
    reconciled += 1;
  }
  return reconciled;
}
