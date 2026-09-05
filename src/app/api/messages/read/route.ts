import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const bodySchema = z.object({ fanUuid: z.string().uuid() });
const audience = [{ isFollower: true }, { isSubscriber: true }, { isExpiredSubscriber: true }];

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const conversation = await prisma.conversation.findFirst({
    where: { creatorId, fan: { fanvueUserId: body.data.fanUuid, isCreatorAccount: false, OR: audience } },
  });
  if (!conversation) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  const token = await getValidFanvueAccessToken(creatorId);
  await fanvueRequest(`/v1/chats/${body.data.fanUuid}`, token, z.unknown(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isRead: true }),
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { unreadMessagesCount: 0 } });
  return NextResponse.json({ ok: true });
}
