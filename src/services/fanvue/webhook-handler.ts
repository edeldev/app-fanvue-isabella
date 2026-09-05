import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { prisma } from "@/lib/prisma";
import { getValidFanvueAccessToken } from "./get-access-token";

const personSchema = z.object({
  uuid: z.string(),
  handle: z.string().optional(),
  display_name: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
});

const messageDataSchema = z.object({
  uuid: z.string(), sender: z.enum(["creator", "fan"]), created_at: z.string().nullable(),
  deleted_at: z.string().nullable(), text: z.string().optional(), unread_messages_count: z.number().int().optional(),
  is_muted: z.boolean().optional(), fan: personSchema,
});
const readDataSchema = z.object({ unread_messages_count: z.number().int(), fan: personSchema });
const followDataSchema = z.object({ follower: personSchema });
const subscriptionDataSchema = z.object({
  id: z.string().nullable(), status: z.enum(["active", "expired"]), cancel_at_period_end: z.boolean(),
  current_period_start: z.string().nullable(), created_at: z.string().nullable(), expires_at: z.string().nullable(), purchaser: personSchema,
});
const paymentDataSchema = z.object({
  id: z.string(), source: z.string(), gross: z.number().int(), currency: z.string().nullable(),
  paid_at: z.string().nullable(), created_at: z.string().nullable(), post_uuid: z.string().nullable(),
  message_uuid: z.string().nullable(), purchaser: personSchema,
});
const reversalDataSchema = z.object({
  id: z.string(), payment_id: z.string().optional(), amount: z.number().int().nullable(), currency: z.string().nullable(),
  created_at: z.string().nullable(), purchaser: personSchema.optional(), payment: z.object({ id: z.string(), purchaser: personSchema }).optional(),
});
const fanInsightSchema = z.object({ spending: z.object({ total: z.object({ total: z.number().int() }) }) });

async function upsertFan(creatorId: string, person: z.infer<typeof personSchema>) {
  return prisma.fan.upsert({
    where: { creatorId_fanvueUserId: { creatorId, fanvueUserId: person.uuid } },
    update: { username: person.handle, displayName: person.display_name, avatarUrl: person.avatar_url },
    create: { creatorId, fanvueUserId: person.uuid, username: person.handle, displayName: person.display_name, avatarUrl: person.avatar_url },
  });
}

async function refreshFanSpending(creatorId: string, fanId: string, fanvueUserId: string) {
  const token = await getValidFanvueAccessToken(creatorId);
  const insight = await fanvueRequest(`/v1/insights/fans/${fanvueUserId}`, token, fanInsightSchema);
  await prisma.fan.update({ where: { id: fanId }, data: { totalSpentMinor: insight.spending.total.total } });
}

export async function handleFanvueWebhook(creatorId: string, type: string, unknownData: unknown) {
  if (type === "creator.follow.created") {
    const data = followDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.follower);
    await prisma.fan.update({ where: { id: fan.id }, data: { isFollower: true, isCreatorAccount: false } });
    return;
  }

  if (type === "creator.message.received" || type === "creator.message.sent" || type === "creator.message.deleted") {
    const data = messageDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.fan);
    const conversation = await prisma.conversation.upsert({
      where: { creatorId_fanId: { creatorId, fanId: fan.id } },
      update: { lastMessageAt: data.created_at ? new Date(data.created_at) : undefined, isMuted: data.is_muted, unreadMessagesCount: data.unread_messages_count },
      create: { creatorId, fanId: fan.id, lastMessageAt: data.created_at ? new Date(data.created_at) : null, isMuted: data.is_muted ?? false, unreadMessagesCount: data.unread_messages_count ?? 0 },
    });
    await prisma.message.upsert({
      where: { creatorId_fanvueMessageId: { creatorId, fanvueMessageId: data.uuid } },
      update: { text: data.text, deletedAt: data.deleted_at ? new Date(data.deleted_at) : null, status: data.deleted_at ? "DELETED" : undefined },
      create: { creatorId, conversationId: conversation.id, fanvueMessageId: data.uuid, direction: data.sender === "fan" ? "INBOUND" : "OUTBOUND", status: data.deleted_at ? "DELETED" : "DELIVERED", text: data.text, sentAt: data.created_at ? new Date(data.created_at) : new Date(), deletedAt: data.deleted_at ? new Date(data.deleted_at) : null },
    });
    return;
  }

  if (type === "creator.message.read") {
    const data = readDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.fan);
    await prisma.conversation.updateMany({ where: { creatorId, fanId: fan.id }, data: { unreadMessagesCount: data.unread_messages_count } });
    return;
  }

  if (type.startsWith("creator.subscription.")) {
    const data = subscriptionDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.purchaser);
    const active = data.status === "active";
    await prisma.fan.update({ where: { id: fan.id }, data: { isSubscriber: active, isExpiredSubscriber: !active, isCreatorAccount: false } });
    if (!active) {
      await prisma.subscription.updateMany({ where: { creatorId, fanId: fan.id }, data: { status: "EXPIRED", endedAt: data.expires_at ? new Date(data.expires_at) : new Date() } });
    } else {
      const startedAt = new Date(data.current_period_start ?? data.created_at ?? Date.now());
      await prisma.subscription.upsert({
        where: { creatorId_fanId_startedAt: { creatorId, fanId: fan.id, startedAt } },
        update: { status: data.cancel_at_period_end ? "CANCEL_AT_PERIOD_END" : "ACTIVE", currentPeriodEndsAt: data.expires_at ? new Date(data.expires_at) : null },
        create: { creatorId, fanId: fan.id, fanvueSubscriptionId: data.id, status: data.cancel_at_period_end ? "CANCEL_AT_PERIOD_END" : "ACTIVE", startedAt, currentPeriodEndsAt: data.expires_at ? new Date(data.expires_at) : null },
      });
    }
    return;
  }

  if (type === "creator.payment.succeeded") {
    const data = paymentDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.purchaser);
    await prisma.purchase.upsert({
      where: { creatorId_fanvuePaymentId: { creatorId, fanvuePaymentId: data.id } },
      update: { source: data.source, amountMinor: data.gross },
      create: { creatorId, fanId: fan.id, fanvuePaymentId: data.id, source: data.source, amountMinor: data.gross, currency: data.currency ?? "USD", externalMessageId: data.message_uuid, externalPostId: data.post_uuid, purchasedAt: new Date(data.paid_at ?? data.created_at ?? Date.now()) },
    });
    await refreshFanSpending(creatorId, fan.id, fan.fanvueUserId);
    return;
  }

  if (type === "creator.refund.created" || type === "creator.dispute.created") {
    const data = reversalDataSchema.parse(unknownData);
    const person = data.purchaser ?? data.payment?.purchaser;
    const paymentId = data.payment_id ?? data.payment?.id;
    if (!person || !paymentId || data.amount === null) return;
    const fan = await upsertFan(creatorId, person);
    await prisma.purchase.upsert({
      where: { creatorId_fanvuePaymentId: { creatorId, fanvuePaymentId: data.id } },
      update: { amountMinor: -Math.abs(data.amount) },
      create: { creatorId, fanId: fan.id, fanvuePaymentId: data.id, source: type === "creator.refund.created" ? "refund" : "chargeback", amountMinor: -Math.abs(data.amount), currency: data.currency ?? "USD", purchasedAt: new Date(data.created_at ?? Date.now()) },
    });
    await prisma.purchase.updateMany({ where: { creatorId, fanvuePaymentId: paymentId }, data: { reversedAt: new Date(data.created_at ?? Date.now()) } });
    await refreshFanSpending(creatorId, fan.id, fan.fanvueUserId);
  }
}
