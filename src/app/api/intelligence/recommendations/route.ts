import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const bodySchema = z.object({
  fanId: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(1_500),
  goal: z.enum(["RELATIONSHIP", "SUBSCRIPTION", "PPV"]),
});

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Recomendación inválida." }, { status: 400 });

  const fan = await prisma.fan.findFirst({
    where: { id: parsed.data.fanId, creatorId, isCreatorAccount: false },
    select: { id: true },
  });
  if (!fan) return Response.json({ error: "Fan no encontrado." }, { status: 404 });

  await prisma.automationLog.create({
    data: {
      creatorId,
      fanId: fan.id,
      eventType: "AI_RECOMMENDATION_USED",
      explanation: "Se copió una recomendación del copiloto para revisión manual.",
      metadata: { text: parsed.data.text, goal: parsed.data.goal },
    },
  });

  return Response.json({ ok: true });
}
