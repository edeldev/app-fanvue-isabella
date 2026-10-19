import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

const reviewSchema = z.object({ action: z.enum(["confirm_sent", "discard"]), verifiedInFanvue: z.boolean().optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.workflowMutation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  const input = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Decisión de revisión inválida." }, { status: 400 });
  if (input.data.action === "confirm_sent" && !input.data.verifiedInFanvue) {
    return NextResponse.json({ error: "Confirma que encontraste el mensaje en Fanvue." }, { status: 400 });
  }
  const { messageId } = await params;
  const reviewed = await prisma.$transaction(async (transaction) => {
    const item = await transaction.scheduledMessage.findFirst({
      where: { id: messageId, creatorId, status: "NEEDS_REVIEW" },
      select: { id: true, fanId: true },
    });
    if (!item) return false;
    const changed = await transaction.scheduledMessage.updateMany({
      where: { id: item.id, creatorId, status: "NEEDS_REVIEW" },
      data: input.data.action === "confirm_sent"
        ? { status: "CONFIRMED_EXTERNALLY", lastError: "MANUALLY_VERIFIED_IN_FANVUE" }
        : { status: "CANCELLED", lastError: "DISCARDED_AFTER_REVIEW" },
    });
    if (!changed.count) return false;
    await transaction.automationLog.create({
      data: {
        creatorId, fanId: item.fanId,
        eventType: input.data.action === "confirm_sent" ? "SCHEDULED_MESSAGE_VERIFIED_MANUALLY" : "SCHEDULED_MESSAGE_DISCARDED_AFTER_REVIEW",
        explanation: input.data.action === "confirm_sent"
          ? "El administrador comprobó en Fanvue un envío programado incierto y lo cerró sin reenviar."
          : "El administrador descartó un envío programado incierto sin reenviar.",
        metadata: { scheduledMessageId: item.id, action: input.data.action },
      },
    });
    return true;
  });
  if (!reviewed) return NextResponse.json({ error: "Este mensaje ya no está pendiente de revisión." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { messageId } = await params;
  const cancelled = await prisma.scheduledMessage.updateMany({
    where: { id: messageId, creatorId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (!cancelled.count) return NextResponse.json({ error: "El mensaje ya fue enviado o no se puede cancelar." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
