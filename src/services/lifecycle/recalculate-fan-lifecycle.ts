import type { FanLifecycleStage, Prisma } from "@prisma/client";
import { calculateFanLifecycleStage } from "@/domain/lifecycle/calculate-stage";
import { prisma } from "@/lib/prisma";

export async function recalculateFanLifecycle(
  creatorId: string,
  fanId: string,
  source = "SYSTEM",
) {
  const fan = await prisma.fan.findFirst({
    where: { id: fanId, creatorId },
    include: {
      subscriptions: { orderBy: { startedAt: "desc" } },
      purchases: { where: { amountMinor: { gt: 0 }, reversedAt: null }, select: { id: true } },
      conversations: {
        take: 1,
        orderBy: { lastMessageAt: "desc" },
        include: { messages: { where: { direction: "INBOUND", deletedAt: null }, select: { id: true } } },
      },
      memories: {
        where: { status: "ACTIVE", category: "PURCHASE_INTENT" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!fan) return null;

  const activeSubscription = fan.subscriptions.find((subscription) =>
    subscription.status === "ACTIVE" || subscription.status === "CANCEL_AT_PERIOD_END");
  const lastEndedSubscription = fan.subscriptions.find((subscription) =>
    subscription.status === "EXPIRED" || subscription.status === "CANCELLED" || Boolean(subscription.endedAt));
  const wasReactivatedRecently = Boolean(
    activeSubscription &&
    lastEndedSubscription &&
    activeSubscription.startedAt > (lastEndedSubscription.endedAt ?? lastEndedSubscription.updatedAt) &&
    Date.now() - activeSubscription.startedAt.getTime() <= 30 * 86_400_000,
  );
  const calculated = calculateFanLifecycleStage({
    isFollower: fan.isFollower,
    isSubscriber: fan.isSubscriber,
    isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
    isNonRenewingSubscriber: fan.isNonRenewingSubscriber,
    isExpiredSubscriber: fan.isExpiredSubscriber,
    isTopSpender: fan.isTopSpender,
    totalSpentMinor: fan.totalSpentMinor,
    paidPurchasesCount: fan.purchases.length,
    inboundMessagesCount: fan.conversations[0]?.messages.length ?? 0,
    hasPurchaseIntent: fan.memories.length > 0,
    lastActivityAt: fan.lastActivityAt,
    activeSubscriptionStartedAt: activeSubscription?.startedAt ?? null,
    wasReactivatedRecently,
  });
  const nextStage: FanLifecycleStage = fan.lifecycleOverride ?? calculated.stage;
  const reason = fan.lifecycleOverride
    ? `Etapa fijada manualmente en ${fan.lifecycleOverride}.`
    : calculated.reason;
  if (fan.lifecycleStage === nextStage && fan.lifecycleReason === reason) {
    return { changed: false, stage: nextStage, reason };
  }

  const occurredAt = new Date();
  const payload: Prisma.InputJsonObject = {
    previousStage: fan.lifecycleStage,
    newStage: nextStage,
    reason,
    source,
    automatic: fan.lifecycleOverride === null,
  };
  await prisma.$transaction([
    prisma.fan.update({
      where: { id: fan.id },
      data: { lifecycleStage: nextStage, lifecycleChangedAt: occurredAt, lifecycleReason: reason },
    }),
    prisma.fanEvent.create({
      data: { creatorId, fanId: fan.id, type: "LIFECYCLE_STAGE_CHANGED", occurredAt, payload },
    }),
  ]);
  return { changed: true, stage: nextStage, reason };
}
