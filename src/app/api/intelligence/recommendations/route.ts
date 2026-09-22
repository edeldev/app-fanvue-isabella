import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const bodySchema = z.object({
  fanId: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(1_500),
  goal: z.enum(["RELATIONSHIP", "SUBSCRIPTION", "PPV"]),
  action: z.enum(["COPIED", "HELPFUL", "NOT_HELPFUL"]).default("COPIED"),
  reason: z.enum(["WRONG_CONTEXT", "WRONG_TONE", "TOO_EARLY", "REPEATED"]).optional(),
});

export async function GET() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });

  const [messages, fans, subscriptions, purchases, recommendations] = await Promise.all([
    prisma.message.aggregate({ where: { creatorId }, _max: { updatedAt: true } }),
    prisma.fan.aggregate({ where: { creatorId, isCreatorAccount: false }, _max: { updatedAt: true } }),
    prisma.subscription.aggregate({ where: { creatorId }, _max: { updatedAt: true } }),
    prisma.purchase.aggregate({ where: { creatorId }, _max: { updatedAt: true } }),
    prisma.automationLog.aggregate({
      where: { creatorId, eventType: { in: ["AI_RECOMMENDATION_USED", "AI_RECOMMENDATION_HELPFUL", "AI_RECOMMENDATION_REJECTED"] } },
      _max: { occurredAt: true },
    }),
  ]);
  const latest = [
    messages._max.updatedAt,
    fans._max.updatedAt,
    subscriptions._max.updatedAt,
    purchases._max.updatedAt,
    recommendations._max.occurredAt,
  ].reduce<Date | null>((current, value) => !value || (current && current >= value) ? current : value, null);

  return Response.json({ revision: latest?.toISOString() ?? "empty" });
}

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

  const event = {
    COPIED: { eventType: "AI_RECOMMENDATION_USED", explanation: "Se copió una recomendación del copiloto para revisión manual." },
    HELPFUL: { eventType: "AI_RECOMMENDATION_HELPFUL", explanation: "La recomendación del copiloto fue marcada como útil." },
    NOT_HELPFUL: { eventType: "AI_RECOMMENDATION_REJECTED", explanation: "La recomendación del copiloto fue descartada manualmente." },
  }[parsed.data.action];
  await prisma.automationLog.create({
    data: {
      creatorId,
      fanId: fan.id,
      ...event,
      metadata: { text: parsed.data.text, goal: parsed.data.goal, action: parsed.data.action, reason: parsed.data.reason },
    },
  });

  return Response.json({ ok: true });
}
