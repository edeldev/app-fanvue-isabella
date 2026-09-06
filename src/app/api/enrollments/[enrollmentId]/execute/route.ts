import { cookies } from "next/headers";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { executeEnrollmentStep } from "@/services/workflows/execute-enrollment";

export async function POST(_request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  try {
    const result = await executeEnrollmentStep(creatorId, (await params).enrollmentId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar el paso.";
    const status = message === "ENROLLMENT_NOT_FOUND" ? 404 : message.startsWith("STEP_NOT_IMPLEMENTED") || message.startsWith("ENROLLMENT_NOT_DUE") || message.startsWith("ENROLLMENT_") || message.startsWith("STEP_") || message.startsWith("WORKFLOW_") ? 409 : 502;
    return Response.json({ error: message }, { status });
  }
}
