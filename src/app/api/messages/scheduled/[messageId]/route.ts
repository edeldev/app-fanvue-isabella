import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

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
