import { cookies } from "next/headers";
import { z } from "zod";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { startEnrollment } from "@/services/workflows/manage-enrollment";

const inputSchema = z.object({ fanId: z.string().min(1), workflowId: z.string().min(1) });

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Selecciona un fan y un workflow." }, { status: 400 });
  try {
    const enrollment = await startEnrollment(creatorId, input.data.fanId, input.data.workflowId);
    return Response.json({ enrollment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar el workflow.";
    return Response.json({ error: message }, { status: message.includes("NOT_FOUND") ? 404 : 409 });
  }
}
