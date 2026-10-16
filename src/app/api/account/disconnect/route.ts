import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";

export const runtime = "nodejs";

const requestSchema = z.object({ confirmation: z.literal("ELIMINAR") });

export async function DELETE(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestUrl.origin) {
    return NextResponse.json({ error: "Origen de solicitud no válido." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const creatorId = readCreatorSession(
    cookieStore.get(CREATOR_SESSION_COOKIE)?.value,
  );
  if (!creatorId) {
    return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Escribe ELIMINAR para confirmar." },
      { status: 400 },
    );
  }

  const deleted = await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (!deleted.count) {
    return NextResponse.json({ error: "La cuenta local ya no existe." }, { status: 404 });
  }

  cookieStore.delete(CREATOR_SESSION_COOKIE);
  cookieStore.delete("fanvue_oauth_state");
  cookieStore.delete("fanvue_pkce_verifier");

  return NextResponse.json({
    deleted: true,
    fanvueRevocationUrl: "https://www.fanvue.com/settings/account",
  });
}
