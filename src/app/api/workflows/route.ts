import { cookies } from "next/headers";
import { ZodError } from "zod";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { createWorkflow } from "@/services/workflows/save-workflow";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.workflowMutation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  try {
    const workflow = await createWorkflow(creatorId, await request.json());
    return Response.json({ workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Flujo inválido." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo crear el flujo." }, { status: 400 });
  }
}
