import type { MessageStatus, Prisma, SubscriptionStatus } from "@/generated/prisma/client";
import { fetchAllCursorPages } from "@/lib/fanvue/pagination";
import { accountSchema, chatsPageSchema, creatorListPageSchema, earningsPageSchema, fanInsightsBulkSchema, followersPageSchema, subscribersPageSchema } from "@/lib/fanvue/sync-schemas";
import { fanvueRequest } from "@/lib/fanvue/client";
import { fanvueCurrentUserSchema } from "@/lib/fanvue/schemas";
import { prisma } from "@/lib/prisma";
import { getValidFanvueAccessToken } from "./get-access-token";

export interface InitialSyncResult {
  followers: number;
  subscribers: number;
  chats: number;
  earnings: number;
}

function subscriptionStatus(status: string, renews: boolean): SubscriptionStatus {
  if (status === "active") return renews ? "ACTIVE" : "CANCEL_AT_PERIOD_END";
  if (status === "pending_confirmation") return "PENDING";
  if (status === "paused") return "PAUSED";
  return "CANCELLED";
}

function messageStatus(status: string | null | undefined): MessageStatus {
  if (status === "Read") return "READ";
  if (status === "Delivered") return "DELIVERED";
  return "SENT";
}

async function processInBatches<T>(items: T[], worker: (item: T) => Promise<void>, batchSize = 10) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(worker));
  }
}

export async function runInitialFanvueSync(creatorId: string): Promise<InitialSyncResult> {
  const accessToken = await getValidFanvueAccessToken(creatorId);
  const [followers, subscribers, chats, earnings, creatorAccounts, expiredSubscribers, account, profile] = await Promise.all([
    fetchAllCursorPages("/v1/followers", accessToken, followersPageSchema),
    fetchAllCursorPages("/v1/subscribers", accessToken, subscribersPageSchema),
    fetchAllCursorPages("/v1/chats", accessToken, chatsPageSchema),
    fetchAllCursorPages("/v1/insights/earnings", accessToken, earningsPageSchema),
    fetchAllCursorPages("/v1/chats/lists/smart/creators", accessToken, creatorListPageSchema),
    fetchAllCursorPages("/v1/chats/lists/smart/expired_subscribers", accessToken, creatorListPageSchema),
    fanvueRequest("/v1/users/account", accessToken, accountSchema),
    fanvueRequest("/v1/users/me", accessToken, fanvueCurrentUserSchema),
  ]);

  const fanvueContactsCount = new Set([
    ...followers.map((fan) => fan.uuid),
    ...subscribers.map((fan) => fan.uuid),
    ...expiredSubscribers.map((fan) => fan.uuid),
  ]).size;

  await prisma.creator.update({
    where: { id: creatorId },
    data: {
      allTimeEarningsMinor: account.account.earnings.total,
      fanvueFollowersCount: account.account.fans.followers,
      fanvueSubscribersCount: account.account.fans.subscribers,
      fanvueContactsCount,
      username: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      fanvueImageCount: profile.contentCounts?.imageCount,
      fanvueVideoCount: profile.contentCounts?.videoCount,
      fanvueLikesCount: profile.likesCount,
    },
  });

  await prisma.fan.updateMany({ where: { creatorId }, data: { isFollower: false } });
  await processInBatches(followers, async (follower) => {
      await prisma.fan.upsert({
        where: { creatorId_fanvueUserId: { creatorId, fanvueUserId: follower.uuid } },
        update: { username: follower.handle, displayName: follower.displayName, avatarUrl: follower.avatarUrl, isFollower: true, isCreatorAccount: false, isTopSpender: follower.isTopSpender },
        create: { creatorId, fanvueUserId: follower.uuid, username: follower.handle, displayName: follower.displayName, avatarUrl: follower.avatarUrl, isFollower: true, isCreatorAccount: false, isTopSpender: follower.isTopSpender },
      });
  });

  await prisma.fan.updateMany({ where: { creatorId }, data: { isSubscriber: false } });
  await processInBatches(subscribers, async (subscriber) => {
      const fan = await prisma.fan.upsert({
        where: { creatorId_fanvueUserId: { creatorId, fanvueUserId: subscriber.uuid } },
        update: { username: subscriber.handle, displayName: subscriber.displayName, avatarUrl: subscriber.avatarUrl, isSubscriber: true, isCreatorAccount: false, isTopSpender: subscriber.isTopSpender },
        create: { creatorId, fanvueUserId: subscriber.uuid, username: subscriber.handle, displayName: subscriber.displayName, avatarUrl: subscriber.avatarUrl, isSubscriber: true, isCreatorAccount: false, isTopSpender: subscriber.isTopSpender },
      });
      if (subscriber.subscription) {
        const startedAt = new Date(subscriber.subscription.currentPeriodStart);
        await prisma.subscription.upsert({
          where: { creatorId_fanId_startedAt: { creatorId, fanId: fan.id, startedAt } },
          update: { status: subscriptionStatus(subscriber.subscription.status, subscriber.subscription.autoRenewalEnabled), currentPeriodEndsAt: subscriber.subscription.currentPeriodEnd ? new Date(subscriber.subscription.currentPeriodEnd) : null },
          create: { creatorId, fanId: fan.id, status: subscriptionStatus(subscriber.subscription.status, subscriber.subscription.autoRenewalEnabled), startedAt, currentPeriodEndsAt: subscriber.subscription.currentPeriodEnd ? new Date(subscriber.subscription.currentPeriodEnd) : null },
        });
      }
  });

  await prisma.fan.updateMany({ where: { creatorId }, data: { isExpiredSubscriber: false } });
  await processInBatches(expiredSubscribers, async (subscriber) => {
    await prisma.fan.upsert({
      where: { creatorId_fanvueUserId: { creatorId, fanvueUserId: subscriber.uuid } },
      update: { username: subscriber.handle, displayName: subscriber.displayName, isExpiredSubscriber: true },
      create: { creatorId, fanvueUserId: subscriber.uuid, username: subscriber.handle, displayName: subscriber.displayName, isExpiredSubscriber: true },
    });
  });

  await prisma.fan.updateMany({ where: { creatorId }, data: { isCreatorAccount: false } });
  await processInBatches(chats, async (chat) => {
      const fan = await prisma.fan.upsert({
        where: { creatorId_fanvueUserId: { creatorId, fanvueUserId: chat.user.uuid } },
        update: { username: chat.user.handle, displayName: chat.user.displayName, avatarUrl: chat.user.avatarUrl, isCreatorAccount: chat.isCreator ?? false, isTopSpender: chat.user.isTopSpender, lastActivityAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : undefined },
        create: { creatorId, fanvueUserId: chat.user.uuid, username: chat.user.handle, displayName: chat.user.displayName, avatarUrl: chat.user.avatarUrl, isCreatorAccount: chat.isCreator ?? false, isTopSpender: chat.user.isTopSpender, lastActivityAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : undefined },
      });
      const conversation = await prisma.conversation.upsert({
        where: { creatorId_fanId: { creatorId, fanId: fan.id } },
        update: { lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : null, isMuted: chat.isMuted, unreadMessagesCount: chat.unreadMessagesCount },
        create: { creatorId, fanId: fan.id, lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : null, isMuted: chat.isMuted, unreadMessagesCount: chat.unreadMessagesCount },
      });
      if (chat.lastMessage?.sentAt) {
        const inbound = chat.lastMessage.senderRole === "FAN";
        await prisma.message.upsert({
          where: { creatorId_fanvueMessageId: { creatorId, fanvueMessageId: chat.lastMessage.uuid } },
          update: { text: chat.lastMessage.text, status: inbound ? "DELIVERED" : messageStatus(chat.lastMessage.status) },
          create: { creatorId, conversationId: conversation.id, fanvueMessageId: chat.lastMessage.uuid, direction: inbound ? "INBOUND" : "OUTBOUND", status: inbound ? "DELIVERED" : messageStatus(chat.lastMessage.status), text: chat.lastMessage.text, sentAt: new Date(chat.lastMessage.sentAt) },
        });
      }
  });

  await processInBatches(creatorAccounts, async (account) => {
    await prisma.fan.updateMany({
      where: { creatorId, fanvueUserId: account.uuid },
      data: { isCreatorAccount: true },
    });
  });

  await processInBatches(earnings, async (earning) => {
      const fan = earning.user ? await prisma.fan.upsert({
        where: { creatorId_fanvueUserId: { creatorId, fanvueUserId: earning.user.uuid } },
        update: { username: earning.user.handle, displayName: earning.user.displayName, isTopSpender: earning.user.isTopSpender },
        create: { creatorId, fanvueUserId: earning.user.uuid, username: earning.user.handle, displayName: earning.user.displayName, isTopSpender: earning.user.isTopSpender },
      }) : null;
      await prisma.purchase.upsert({
        where: { creatorId_fanvuePaymentId: { creatorId, fanvuePaymentId: earning.transactionOrderId } },
        update: { source: earning.source, amountMinor: earning.gross, externalMessageId: earning.messageUuid, externalPostId: earning.postUuid },
        create: { creatorId, fanId: fan?.id, fanvuePaymentId: earning.transactionOrderId, source: earning.source, amountMinor: earning.gross, currency: "USD", externalMessageId: earning.messageUuid, externalPostId: earning.postUuid, purchasedAt: new Date(earning.date) },
      });
      if (earning.reversedTransactionOrderId) {
        await prisma.purchase.updateMany({ where: { creatorId, fanvuePaymentId: earning.reversedTransactionOrderId }, data: { reversedAt: new Date(earning.date) } });
      }
  });

  const audience = await prisma.fan.findMany({
    where: { creatorId, isCreatorAccount: false, OR: [{ isFollower: true }, { isSubscriber: true }, { isExpiredSubscriber: true }] },
    select: { id: true, fanvueUserId: true },
  });
  for (let index = 0; index < audience.length; index += 20) {
    const batch = audience.slice(index, index + 20);
    const fanUuids = batch.map((fan) => fan.fanvueUserId).join(",");
    const insights = await fanvueRequest(`/v1/insights/fans?fanUuids=${encodeURIComponent(fanUuids)}`, accessToken, fanInsightsBulkSchema);
    await Promise.all(batch.map((fan) => prisma.fan.update({
      where: { id: fan.id },
      data: { totalSpentMinor: insights.results[fan.fanvueUserId]?.spending.total.total ?? 0 },
    })));
  }

  await prisma.automationLog.create({
      data: { creatorId, eventType: "INITIAL_SYNC_COMPLETED", explanation: "Sincronización inicial de Fanvue completada.", metadata: { followers: followers.length, subscribers: subscribers.length, chats: chats.length, earnings: earnings.length } satisfies Prisma.InputJsonValue },
  });
  return { followers: followers.length, subscribers: subscribers.length, chats: chats.length, earnings: earnings.length };
}
