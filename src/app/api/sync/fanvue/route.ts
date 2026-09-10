import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { runInitialFanvueSync } from "@/services/fanvue/initial-sync";
import { consumeRateLimit, rateLimitPolicies } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(cookieStore.get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.redirect(new URL("/?sync=unauthorized", request.url), 303);
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.fanvueSync);
  if (!rateLimit.allowed) return NextResponse.redirect(new URL(`/?sync=rate_limited&retryAfter=${rateLimit.retryAfterSeconds}`, request.url), 303);
  try {
    const result = await runInitialFanvueSync(creatorId);
    logger.info("Fanvue initial sync completed", { creatorId, ...result });
    return NextResponse.redirect(new URL("/?sync=completed", request.url), 303);
  } catch (caught) {
    logger.error("Fanvue initial sync failed", { creatorId, errorName: caught instanceof Error ? caught.name : "UnknownError" });
    return NextResponse.redirect(new URL("/?sync=failed", request.url), 303);
  }
}
