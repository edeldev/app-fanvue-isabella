import { cookies } from "next/headers";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { prisma } from "@/lib/prisma";
import { runInitialFanvueSync } from "@/services/fanvue/initial-sync";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

const RECONCILIATION_INTERVAL_MS = 15 * 60 * 1_000;

export async function POST() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const latest = await prisma.automationLog.findFirst({
    where: { creatorId, eventType: "INITIAL_SYNC_COMPLETED" },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  if (latest && Date.now() - latest.occurredAt.getTime() < RECONCILIATION_INTERVAL_MS) {
    return Response.json({ reconciled: false, nextAt: new Date(latest.occurredAt.getTime() + RECONCILIATION_INTERVAL_MS).toISOString() });
  }
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.fanvueReconciliation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  await runInitialFanvueSync(creatorId);
  return Response.json({ reconciled: true });
}
