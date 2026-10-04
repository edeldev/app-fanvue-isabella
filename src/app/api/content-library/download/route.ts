import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

export async function GET(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Contenido inválido" }, { status: 400 });
  const asset = await prisma.content.findFirst({ where: { id, creatorId }, select: { fanvueContentId: true, name: true } });
  if (!asset?.fanvueContentId) return NextResponse.json({ error: "Este archivo no tiene una descarga disponible." }, { status: 404 });
  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const result = await fanvueRequest(`/v1/media/bulk?mediaUuids=${encodeURIComponent(asset.fanvueContentId)}&variants=main`, token, mediaBulkSchema);
    const media = result.results[asset.fanvueContentId];
    const source = media?.variants.find((variant) => variant.variantType === "main" && variant.url)?.url ?? media?.variants.find((variant) => variant.url)?.url;
    if (!source) return NextResponse.json({ error: "Fanvue no proporcionó una versión descargable." }, { status: 409 });
    const upstream = await fetch(source);
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "No se pudo preparar la descarga." }, { status: 502 });
    const safeName = asset.name.replace(/[^a-zA-Z0-9._ -]/g, "_");
    return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo descargar este archivo desde Fanvue." }, { status: 502 });
  }
}
