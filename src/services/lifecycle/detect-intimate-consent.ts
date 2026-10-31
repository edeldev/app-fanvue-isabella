import { Prisma } from "@prisma/client";
import { detectIntimateContentConsent } from "@/domain/fans/intimate-consent-detection";
import { prisma } from "@/lib/prisma";

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
  if (!granted && !fan.intimateContentOptIn && !fan.intimateContentOptInSource) return detection;

  const occurredAt = messages.find((message) => message.id === incomingMessageId)?.sentAt ?? new Date();
  const payload: Prisma.InputJsonObject = {
    automatic: true,
    evidenceMessageId: incomingMessageId,
    reason: detection.reason,
  };
  await prisma.$transaction([
    prisma.fan.update({
      where: { id: fanId },
      data: {
        intimateContentOptIn: granted,
        intimateContentOptInAt: granted ? occurredAt : null,
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
  ]);
  return detection;
}
