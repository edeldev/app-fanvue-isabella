import { fanvueRequest } from "@/lib/fanvue/client";
import { fetchAllCursorPages } from "@/lib/fanvue/pagination";
import { prisma } from "@/lib/prisma";
import { accountSchema, earningsPageSchema } from "@/lib/fanvue/sync-schemas";
import { getValidFanvueAccessToken } from "./get-access-token";

export async function refreshCreatorEarnings(creatorId: string) {
  const accessToken = await getValidFanvueAccessToken(creatorId);
  const [account, earnings, current] = await Promise.all([
    fanvueRequest("/v1/users/account", accessToken, accountSchema),
    fetchAllCursorPages("/v1/insights/earnings", accessToken, earningsPageSchema),
    prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        allTimeEarningsMinor: true,
        availableEarningsMinor: true,
        pendingEarningsMinor: true,
        lastPayoutAt: true,
      },
    }),
  ]);
  const next = {
    allTimeEarningsMinor: account.account.earnings.total,
    availableEarningsMinor: account.account.earnings.availableBalance,
    pendingEarningsMinor: earnings.reduce(
      (total, earning) => total + (earning.transactionOrderStatus === "pendingBalance" ? earning.net : 0),
      0,
    ),
    lastPayoutAt: account.account.earnings.lastPayoutAt
      ? new Date(account.account.earnings.lastPayoutAt)
      : null,
  };
  const changed = !current
    || current.allTimeEarningsMinor !== next.allTimeEarningsMinor
    || current.availableEarningsMinor !== next.availableEarningsMinor
    || current.pendingEarningsMinor !== next.pendingEarningsMinor
    || current.lastPayoutAt?.getTime() !== next.lastPayoutAt?.getTime();
  await prisma.creator.update({ where: { id: creatorId }, data: next });
  return { changed, ...next };
}
