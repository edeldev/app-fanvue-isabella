import { chatsPageSchema } from "@/lib/fanvue/sync-schemas";
import { fetchAllCursorPages } from "@/lib/fanvue/pagination";
import { prisma } from "@/lib/prisma";
import { getValidFanvueAccessToken } from "./get-access-token";

export async function reconcileFanvuePresence(creatorId: string) {
  const observedAt = new Date();
  const accessToken = await getValidFanvueAccessToken(creatorId);
  const chats = await fetchAllCursorPages("/v1/chats", accessToken, chatsPageSchema);
  const creatorAccounts = await prisma.fan.findMany({
    where: { creatorId, isCreatorAccount: true },
    select: { fanvueUserId: true },
  });
  const creatorIds = new Set(creatorAccounts.map((account) => account.fanvueUserId));
  const actualFans = chats.filter((chat) => chat.isCreator !== true && !creatorIds.has(chat.user.uuid));
  const onlineIds = actualFans.filter((chat) => chat.online === true).map((chat) => chat.user.uuid);
  const offlineIds = actualFans.filter((chat) => chat.online === false).map((chat) => chat.user.uuid);

  const [markedOffline, refreshedOnline] = await prisma.$transaction([
    prisma.fan.updateMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        fanvueUserId: { in: offlineIds },
        isOnline: true,
        OR: [{ presenceChangedAt: null }, { presenceChangedAt: { lt: observedAt } }],
      },
      data: { isOnline: false, presenceChangedAt: observedAt },
    }),
    prisma.fan.updateMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        fanvueUserId: { in: onlineIds },
        OR: [{ presenceChangedAt: null }, { presenceChangedAt: { lte: observedAt } }],
      },
      data: { isOnline: true, presenceChangedAt: observedAt },
    }),
  ]);

  return {
    checkedFans: actualFans.length,
    onlineFans: onlineIds.length,
    correctedOffline: markedOffline.count,
    refreshedOnline: refreshedOnline.count,
  };
}
