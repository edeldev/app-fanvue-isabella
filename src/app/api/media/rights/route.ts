import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hasAcceptedMediaRights, MEDIA_RIGHTS_VERSION } from "@/lib/media-rights";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

async function creatorIdFromSession() {
  return readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
}

export async function GET() {
  const creatorId = await creatorIdFromSession();
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const settings = await prisma.settings.findUnique({ where: { creatorId }, select: { mediaRightsAcceptedAt: true, mediaRightsVersion: true } });
  return Response.json({ accepted: hasAcceptedMediaRights(settings) });
}

export async function POST(request: Request) {
  const creatorId = await creatorIdFromSession();
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Solicitud inválida." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || (body as Record<string, unknown>).rightsConfirmed !== true || (body as Record<string, unknown>).peopleConfirmed !== true || (body as Record<string, unknown>).termsConfirmed !== true) {
    return Response.json({ error: "Confirma los derechos, permisos y políticas antes de subir archivos." }, { status: 400 });
  }
  const acceptedAt = new Date();
  await prisma.settings.upsert({
    where: { creatorId },
    create: { creatorId, mediaRightsAcceptedAt: acceptedAt, mediaRightsVersion: MEDIA_RIGHTS_VERSION },
    update: { mediaRightsAcceptedAt: acceptedAt, mediaRightsVersion: MEDIA_RIGHTS_VERSION },
  });
  return Response.json({ accepted: true, acceptedAt: acceptedAt.toISOString() });
}
