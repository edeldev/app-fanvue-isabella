import { cookies } from "next/headers";
import { z } from "zod";
import { fanvueDelete, fanvueRequest } from "@/lib/fanvue/client";
import { FanvueError } from "@/lib/fanvue/errors";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const identifiers = z.object({ messageUuid: z.string().uuid(), fanUuid: z.string().uuid() });
const providerMessage = z.object({
  uuid: z.string().uuid(),
  sender: z.object({ uuid: z.string().uuid() }).passthrough(),
}).passthrough();

export async function DELETE(request: Request, { params }: { params: Promise<{ messageUuid: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.messageDelete);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  const parsed = identifiers.safeParse({ messageUuid: (await params).messageUuid, fanUuid: new URL(request.url).searchParams.get("fan") });
  if (!parsed.success) return Response.json({ error: "Mensaje no válido." }, { status: 400 });

  const fan = await prisma.fan.findFirst({ where: { creatorId, fanvueUserId: parsed.data.fanUuid, isCreatorAccount: false }, select: { id: true } });
  if (!fan) return Response.json({ error: "Conversación no encontrada." }, { status: 404 });
  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const message = await fanvueRequest(
      `/v1/chats/${parsed.data.fanUuid}/messages/${parsed.data.messageUuid}`,
      token,
      providerMessage,
    );
    if (message.sender.uuid === parsed.data.fanUuid) {
      return Response.json({ error: "Solo puedes eliminar mensajes enviados por tu cuenta." }, { status: 403 });
    }
    await fanvueDelete(`/v1/chats/${parsed.data.fanUuid}/messages/${parsed.data.messageUuid}`, token);
    await prisma.message.updateMany({
      where: { creatorId, fanvueMessageId: parsed.data.messageUuid, direction: "OUTBOUND" },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof FanvueError && error.status === 429) return Response.json({ error: "Fanvue limitó temporalmente la operación. Inténtalo más tarde." }, { status: 429 });
    if (error instanceof FanvueError && (error.status === 403 || error.status === 404)) return Response.json({ error: "Fanvue no permite eliminar este mensaje o ya no existe." }, { status: error.status });
    return Response.json({ error: "No se pudo eliminar el mensaje en Fanvue." }, { status: 502 });
  }
}
