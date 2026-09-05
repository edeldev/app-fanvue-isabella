import { cookies } from "next/headers";
import { z } from "zod";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { transitionEnrollment } from "@/services/workflows/manage-enrollment";

const inputSchema = z.object({ action: z.enum(["pause", "resume", "cancel"]), reason: z.string().trim().max(250).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Acción de enrollment inválida." }, { status: 400 });
  try {
    const enrollment = await transitionEnrollment(creatorId, (await params).enrollmentId, input.data.action, input.data.reason);
    return Response.json({ enrollment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cambiar el enrollment.";
    return Response.json({ error: message }, { status: message === "ENROLLMENT_NOT_FOUND" ? 404 : 409 });
  }
}
