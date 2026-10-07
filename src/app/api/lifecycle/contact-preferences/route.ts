import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

const schema = z.object({ fanIds: z.array(z.string().min(1)).min(1).max(2_000) });

export async function PATCH(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.workflowMutation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Selecciona al menos un fan." }, { status: 400 });

  const fans = await prisma.fan.findMany({
    where: { creatorId, id: { in: parsed.data.fanIds }, doNotMessage: true },
    select: { id: true },
  });
  if (!fans.length) return NextResponse.json({ updated: 0 });
  const fanIds = fans.map((fan) => fan.id);
  const now = new Date();
  const enrollments = await prisma.workflowEnrollment.findMany({
    where: { creatorId, fanId: { in: fanIds }, status: "PAUSED", pauseReason: "FAN_DO_NOT_MESSAGE" },
    select: { id: true, fanId: true, pausedFromStatus: true, pausedRemainingSeconds: true },
  });

  await prisma.$transaction([
    prisma.fan.updateMany({
      where: { creatorId, id: { in: fanIds } },
      data: { doNotMessage: false, doNotMessageReason: null, doNotMessageAt: null },
    }),
    ...enrollments.map((enrollment) => prisma.workflowEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: enrollment.pausedFromStatus === "WAITING" ? "WAITING" : "ACTIVE",
        nextRunAt: enrollment.pausedFromStatus === "WAITING" && enrollment.pausedRemainingSeconds !== null
          ? new Date(now.getTime() + enrollment.pausedRemainingSeconds * 1_000)
          : null,
        pausedAt: null,
        pausedFromStatus: null,
        pausedRemainingSeconds: null,
        pauseReason: null,
      },
    })),
    prisma.fanEvent.createMany({
      data: fanIds.map((fanId) => ({ creatorId, fanId, type: "FAN_DO_NOT_MESSAGE_DISABLED", occurredAt: now, payload: { source: "WORKFLOW_AUTOMATIC_EXCLUSIONS" } })),
    }),
  ]);

  return NextResponse.json({ updated: fanIds.length, resumed: enrollments.length });
}
