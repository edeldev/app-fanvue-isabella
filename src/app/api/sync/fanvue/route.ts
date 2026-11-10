import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { runInitialFanvueSync } from "@/services/fanvue/initial-sync";
import { consumeRateLimit, rateLimitPolicies } from "@/lib/rate-limit";

export async function POST() {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(cookieStore.get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.fanvueManualSync);
  if (!rateLimit.allowed) return NextResponse.json({ status: "rate_limited", retryAfter: rateLimit.retryAfterSeconds }, { status: 429 });
  try {
    const result = await runInitialFanvueSync(creatorId);
    logger.info("Fanvue initial sync completed", { creatorId, ...result });
    return NextResponse.json({ status: "completed", result });
  } catch (caught) {
    logger.error("Fanvue initial sync failed", { creatorId, errorName: caught instanceof Error ? caught.name : "UnknownError" });
    return NextResponse.json({ status: "failed" }, { status: 502 });
  }
}
