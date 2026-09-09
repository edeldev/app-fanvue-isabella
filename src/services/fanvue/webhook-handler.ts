import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { prisma } from "@/lib/prisma";
import { getValidFanvueAccessToken } from "./get-access-token";
import { triggerWorkflowForFan } from "@/services/workflows/trigger-workflow";
import { pauseEnrollmentsOnFanReply, recordFanReplyInActiveWorkflows } from "@/services/workflows/manage-enrollment";
import { fetchAllCursorPages } from "@/lib/fanvue/pagination";
import { creatorListPageSchema } from "@/lib/fanvue/sync-schemas";
import { completeMatchingWorkflowGoals } from "@/services/workflows/complete-workflow-goals";

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
const fanStatusDataSchema = z.object({
  object: z.literal("fan_status"), change_type: z.enum(["presence", "mute"]),
  state: z.enum(["online", "offline", "muted", "unmuted"]), changed_at: z.string(), fan: personSchema,
});
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
  return insight.spending.total.total;
}

async function refreshSubscriptionSegments(creatorId: string, fanId: string, fanvueUserId: string) {
  const token = await getValidFanvueAccessToken(creatorId);
  const [freeTrials, autoRenewing, nonRenewing] = await Promise.all([
    fetchAllCursorPages("/v1/chats/lists/smart/free_trial_subscribers", token, creatorListPageSchema),
    fetchAllCursorPages("/v1/chats/lists/smart/auto_renewing", token, creatorListPageSchema),
    fetchAllCursorPages("/v1/chats/lists/smart/non_renewing", token, creatorListPageSchema),
  ]);
  const belongsTo = (members: typeof freeTrials) => members.some((member) => member.uuid === fanvueUserId);
  const isFreeTrialSubscriber = belongsTo(freeTrials);
  await prisma.$transaction([
    prisma.fan.update({ where: { id: fanId }, data: { isFreeTrialSubscriber, isAutoRenewingSubscriber: belongsTo(autoRenewing), isNonRenewingSubscriber: belongsTo(nonRenewing) } }),
    prisma.subscription.updateMany({ where: { creatorId, fanId, status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } }, data: { isFreeTrial: isFreeTrialSubscriber } }),
  ]);
}

export async function handleFanvueWebhook(creatorId: string, type: string, unknownData: unknown) {
  if (type === "creator.fan.presence_changed" || type === "creator.fan.status_changed") {
    const data = fanStatusDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.fan);
    const changedAt = new Date(data.changed_at);
    if (data.change_type === "presence" && (data.state === "online" || data.state === "offline")) {
      const updated = await prisma.fan.updateMany({
        where: { id: fan.id, OR: [{ presenceChangedAt: null }, { presenceChangedAt: { lt: changedAt } }] },
        data: { isOnline: data.state === "online", presenceChangedAt: changedAt },
      });
      if (updated.count && data.state === "online") await triggerWorkflowForFan(creatorId, fan.id, "PRESENCE_ONLINE");
    } else if (data.change_type === "mute" && (data.state === "muted" || data.state === "unmuted")) {
      await prisma.fan.update({ where: { id: fan.id }, data: { isMuted: data.state === "muted" } });
    }
    return;
  }

  if (type === "creator.follow.created") {
    const data = followDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.follower);
    await prisma.fan.update({ where: { id: fan.id }, data: { isFollower: true, isCreatorAccount: false } });
    await triggerWorkflowForFan(creatorId, fan.id, "FOLLOW_CREATED");
    return;
  }

  if (type === "creator.message.received" || type === "creator.message.sent" || type === "creator.message.deleted") {
    const data = messageDataSchema.parse(unknownData);
    const fan = await upsertFan(creatorId, data.fan);
    if (typeof data.is_muted === "boolean") {
      await prisma.fan.update({ where: { id: fan.id }, data: { isMuted: data.is_muted } });
    }
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
    if (type === "creator.message.received" && data.sender === "fan") {
      const repliedAt = data.created_at ? new Date(data.created_at) : new Date();
      await recordFanReplyInActiveWorkflows(creatorId, fan.id, data.uuid, repliedAt);
      await pauseEnrollmentsOnFanReply(creatorId, fan.id, data.uuid, repliedAt);
      await triggerWorkflowForFan(creatorId, fan.id, "MESSAGE_RECEIVED");
    }
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
    await prisma.fan.update({
      where: { id: fan.id },
      data: {
        isSubscriber: active,
        isExpiredSubscriber: !active,
        isAutoRenewingSubscriber: active && !data.cancel_at_period_end,
        isNonRenewingSubscriber: active && data.cancel_at_period_end,
        isCreatorAccount: false,
      },
    });
    if (!active) {
      await prisma.subscription.updateMany({ where: { creatorId, fanId: fan.id }, data: { status: "EXPIRED", endedAt: data.expires_at ? new Date(data.expires_at) : new Date() } });
    } else {
      const startedAt = new Date(data.current_period_start ?? data.created_at ?? Date.now());
      await prisma.subscription.upsert({
        where: { creatorId_fanId_startedAt: { creatorId, fanId: fan.id, startedAt } },
        update: { status: data.cancel_at_period_end ? "CANCEL_AT_PERIOD_END" : "ACTIVE", autoRenewalEnabled: !data.cancel_at_period_end, currentPeriodEndsAt: data.expires_at ? new Date(data.expires_at) : null },
        create: { creatorId, fanId: fan.id, fanvueSubscriptionId: data.id, status: data.cancel_at_period_end ? "CANCEL_AT_PERIOD_END" : "ACTIVE", autoRenewalEnabled: !data.cancel_at_period_end, startedAt, currentPeriodEndsAt: data.expires_at ? new Date(data.expires_at) : null },
      });
    }
    const trigger = type === "creator.subscription.activated" ? "SUBSCRIPTION_ACTIVATED"
      : type === "creator.subscription.renewed" ? "SUBSCRIPTION_RENEWED"
        : type === "creator.subscription.deactivated" ? "SUBSCRIPTION_DEACTIVATED"
          : "RENEWAL_CHANGED";
    await refreshSubscriptionSegments(creatorId, fan.id, fan.fanvueUserId);
    const refreshedFan = await prisma.fan.findUnique({ where: { id: fan.id }, select: { isSubscriber: true, isFreeTrialSubscriber: true } });
    if (active && refreshedFan?.isSubscriber && !refreshedFan.isFreeTrialSubscriber) {
      await completeMatchingWorkflowGoals(creatorId, fan.id, { kind: "PAID_SUBSCRIPTION" }, { subscriptionId: data.id, occurredAt: data.created_at ?? new Date().toISOString() });
    }
    await triggerWorkflowForFan(creatorId, fan.id, trigger);
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
    const totalSpentMinor = await refreshFanSpending(creatorId, fan.id, fan.fanvueUserId);
    if (data.gross > 0) {
      const paidPurchasesCount = await prisma.purchase.count({ where: { creatorId, fanId: fan.id, amountMinor: { gt: 0 }, reversedAt: null } });
      const normalizedSource = data.source.toLocaleLowerCase("en-US");
      const isTip = normalizedSource.includes("tip");
      const isPpv = !isTip && Boolean(data.message_uuid || data.post_uuid);
      await completeMatchingWorkflowGoals(creatorId, fan.id, { kind: "PAYMENT", amountMinor: data.gross, totalSpentMinor, paidPurchasesCount, isTip, isPpv }, { paymentId: data.id, source: data.source, amountMinor: data.gross, totalSpentMinor });
    }
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
