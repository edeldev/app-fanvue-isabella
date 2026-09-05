import { cookies } from "next/headers";
import { z } from "zod";
import { activityRetentionCutoff, workflowActivityEventTypes } from "@/domain/workflows/activity";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const inputSchema = z.object({ scope: z.enum(["older_than_90_days", "all"]) });

export async function DELETE(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });

  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Selecciona un alcance válido." }, { status: 400 });

  const result = await prisma.automationLog.deleteMany({
    where: {
      creatorId,
      eventType: { in: [...workflowActivityEventTypes] },
      ...(input.data.scope === "older_than_90_days"
        ? { occurredAt: { lt: activityRetentionCutoff(new Date()) } }
        : {}),
    },
  });

  return Response.json({ deleted: result.count });
}
