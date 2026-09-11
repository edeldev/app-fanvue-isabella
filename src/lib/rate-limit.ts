import { prisma } from "@/lib/prisma";

export interface RateLimitPolicy { scope: string; limit: number; windowSeconds: number }
export interface RateLimitResult { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number }

interface BucketRow { requestCount: number; expiresAt: Date }

export const rateLimitPolicies = {
  messageSend: { scope: "message-send", limit: 30, windowSeconds: 60 },
  mediaUpload: { scope: "media-upload", limit: 20, windowSeconds: 600 },
  fanvueManualSync: { scope: "fanvue-manual-sync", limit: 3, windowSeconds: 900 },
  fanvueReconciliation: { scope: "fanvue-reconciliation", limit: 1, windowSeconds: 900 },
  fanvuePresence: { scope: "fanvue-presence", limit: 2, windowSeconds: 60 },
  workflowMutation: { scope: "workflow-mutation", limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export async function consumeRateLimit(creatorId: string, policy: RateLimitPolicy, now = new Date()): Promise<RateLimitResult> {
  const id = `${creatorId}:${policy.scope}`;
  const expiresAt = new Date(now.getTime() + policy.windowSeconds * 1_000);
  const rows = await prisma.$queryRaw<BucketRow[]>`
    INSERT INTO "RateLimitBucket" ("id", "creatorId", "scope", "requestCount", "windowStartedAt", "expiresAt", "updatedAt")
    VALUES (${id}, ${creatorId}, ${policy.scope}, 1, ${now}, ${expiresAt}, ${now})
    ON CONFLICT ("id") DO UPDATE SET
      "requestCount" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."requestCount" + 1 END,
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStartedAt" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "requestCount", "expiresAt"
  `;
  const bucket = rows[0];
  if (!bucket) throw new Error("RATE_LIMIT_STORAGE_ERROR");
  return {
    allowed: bucket.requestCount <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - bucket.requestCount),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1_000)),
  };
}

export function rateLimitedResponse(result: RateLimitResult) {
  return Response.json({ error: "Demasiadas solicitudes. Intenta nuevamente en unos momentos.", retryAfterSeconds: result.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "X-RateLimit-Limit": String(result.limit), "X-RateLimit-Remaining": String(result.remaining) } });
}
