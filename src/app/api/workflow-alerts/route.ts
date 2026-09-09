import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const inputSchema = z.union([
  z.object({ scope: z.literal("all") }),
  z.object({ scope: z.literal("one"), alertId: z.string().min(1) }),
]);
const failureEventTypes = ["WORKFLOW_STEP_FAILED", "WORKFLOW_FAILED"];

export async function PATCH(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Solicitud de alerta inválida." }, { status: 400 });
  const result = await prisma.automationLog.updateMany({
    where: {
      creatorId,
      level: "ERROR",
      eventType: { in: failureEventTypes },
      reviewedAt: null,
      ...(input.data.scope === "one" ? { id: input.data.alertId } : {}),
    },
    data: { reviewedAt: new Date() },
  });
  return Response.json({ reviewed: result.count });
}
