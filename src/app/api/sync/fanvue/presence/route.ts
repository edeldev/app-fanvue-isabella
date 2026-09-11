import { cookies } from "next/headers";
import { rateLimitedResponse, consumeRateLimit, rateLimitPolicies } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { reconcileFanvuePresence } from "@/services/fanvue/reconcile-presence";

export async function POST() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.fanvuePresence);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  try {
    return Response.json(await reconcileFanvuePresence(creatorId));
  } catch (error) {
    logger.error("Fanvue presence reconciliation failed", {
      creatorId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "No se pudo comprobar la presencia en Fanvue." }, { status: 502 });
  }
}
