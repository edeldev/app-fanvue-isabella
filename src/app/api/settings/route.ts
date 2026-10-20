import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mandatorySendCeilings } from "@/domain/messages/mandatory-send-limits";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const settingsSchema = z.object({
  timezone: z.string().min(1).max(100),
  sendWindowEnabled: z.boolean(),
  sendingWindowStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sendingWindowEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sendingWindowDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  sendLimitsEnabled: z.literal(true),
  maxMessagesPerHour: z.number().int().min(1).max(mandatorySendCeilings.perHour),
  maxMessagesPerDay: z.number().int().min(1).max(mandatorySendCeilings.perDay),
  minMinutesBetweenFanMessages: z.number().int().min(0).max(43_200),
  minimumDelaySeconds: z.number().int().min(1).max(86_400),
  maximumRetries: z.number().int().min(1).max(10),
  debugMode: z.boolean(),
  aiMessagingEnabled: z.boolean(),
  aiProfileLabelConfirmed: z.boolean(),
});

export async function PUT(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Configuración inválida." }, { status: 400 });
  const settings = await prisma.settings.upsert({
    where: { creatorId },
    update: parsed.data,
    create: { creatorId, ...parsed.data },
  });
  return Response.json({ settings });
}
