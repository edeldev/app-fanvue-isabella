import { prisma } from "@/lib/prisma";

export type AutomatedSendLimits = {
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
  minMinutesBetweenFanMessages: number;
};

type Bucket = { requestCount: number; expiresAt: Date } | null;
type LimitReason = "AUTOMATED_HOURLY_LIMIT" | "AUTOMATED_DAILY_LIMIT" | "AUTOMATED_FAN_INTERVAL";
type BudgetResult = { allowed: true } | { allowed: false; reasonCode: LimitReason; nextRunAt: Date };

export function evaluateAutomatedSendBuckets(
  buckets: { hour: Bucket; day: Bucket; fan: Bucket },
  limits: AutomatedSendLimits,
  now: Date,
): BudgetResult {
  const blocks: Array<{ reasonCode: LimitReason; nextRunAt: Date }> = [];
  if (buckets.hour && buckets.hour.expiresAt > now && buckets.hour.requestCount >= limits.maxMessagesPerHour)
    blocks.push({ reasonCode: "AUTOMATED_HOURLY_LIMIT", nextRunAt: buckets.hour.expiresAt });
  if (buckets.day && buckets.day.expiresAt > now && buckets.day.requestCount >= limits.maxMessagesPerDay)
    blocks.push({ reasonCode: "AUTOMATED_DAILY_LIMIT", nextRunAt: buckets.day.expiresAt });
  if (limits.minMinutesBetweenFanMessages > 0 && buckets.fan && buckets.fan.expiresAt > now)
    blocks.push({ reasonCode: "AUTOMATED_FAN_INTERVAL", nextRunAt: buckets.fan.expiresAt });
  if (!blocks.length) return { allowed: true };
  return { allowed: false, ...blocks.reduce((latest, block) => block.nextRunAt > latest.nextRunAt ? block : latest) };
}

export async function reserveAutomatedSendBudget(input: {
  creatorId: string;
  fanId: string;
  limits: AutomatedSendLimits;
  now: Date;
}): Promise<BudgetResult> {
  const { creatorId, fanId, limits, now } = input;
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${creatorId}))`;
    const scopes = {
      hour: "automated-send-hour",
      day: "automated-send-day",
      fan: `automated-send-fan:${fanId}`,
    };
    const rows = await transaction.rateLimitBucket.findMany({
      where: { id: { in: Object.values(scopes).map((scope) => `${creatorId}:${scope}`) } },
      select: { scope: true, requestCount: true, expiresAt: true },
    });
    const bucket = (scope: string): Bucket => rows.find((row) => row.scope === scope) ?? null;
    const decision = evaluateAutomatedSendBuckets({ hour: bucket(scopes.hour), day: bucket(scopes.day), fan: bucket(scopes.fan) }, limits, now);
    if (!decision.allowed) return decision;

    const windows = [
      { scope: scopes.hour, seconds: 60 * 60 },
      { scope: scopes.day, seconds: 24 * 60 * 60 },
      ...(limits.minMinutesBetweenFanMessages > 0 ? [{ scope: scopes.fan, seconds: limits.minMinutesBetweenFanMessages * 60 }] : []),
    ];
    for (const window of windows) {
      const previous = bucket(window.scope);
      await transaction.rateLimitBucket.upsert({
        where: { id: `${creatorId}:${window.scope}` },
        update: previous && previous.expiresAt > now
          ? { requestCount: { increment: 1 }, updatedAt: now }
          : { requestCount: 1, windowStartedAt: now, expiresAt: new Date(now.getTime() + window.seconds * 1_000), updatedAt: now },
        create: { id: `${creatorId}:${window.scope}`, creatorId, scope: window.scope, requestCount: 1, windowStartedAt: now, expiresAt: new Date(now.getTime() + window.seconds * 1_000), updatedAt: now },
      });
    }
    return { allowed: true };
  });
}
