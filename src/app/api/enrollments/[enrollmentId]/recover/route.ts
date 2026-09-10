import { cookies } from "next/headers";
import { z } from "zod";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { executeEnrollmentUntilBlocked } from "@/services/workflows/execute-enrollment";
import { recoverFailedEnrollment } from "@/services/workflows/recover-enrollment";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

const inputSchema = z.object({ action: z.enum(["retry_now", "resume_from_failed", "cancel"]) });

export async function POST(request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.workflowMutation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Acción de recuperación inválida." }, { status: 400 });
  const enrollmentId = (await params).enrollmentId;
  try {
    const recovery = await recoverFailedEnrollment(creatorId, enrollmentId, input.data.action);
    const execution = input.data.action === "retry_now" ? await executeEnrollmentUntilBlocked(creatorId, enrollmentId) : null;
    return Response.json({ recovery, execution });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo recuperar el workflow.";
    const status = message === "ENROLLMENT_NOT_FOUND" ? 404 : 409;
    return Response.json({ error: message }, { status });
  }
}
