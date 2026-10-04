import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { createZipStream, zipContentLength } from "@/lib/zip-stream";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const inputSchema = z.object({ ids: z.array(z.string()).min(1).max(100), mode: z.enum(["all", "photos", "videos"]).default("all"), filename: z.string().trim().min(1).max(100).default("selected-content") });
const safe = (name: string) => name.replace(/[^a-zA-Z0-9._ -]/g, "_");

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Selección inválida" }, { status: 400 });
  const records = await prisma.content.findMany({ where: { creatorId, id: { in: parsed.data.ids }, ...(parsed.data.mode === "photos" ? { type: "image" } : parsed.data.mode === "videos" ? { type: "video" } : {}) }, select: { id: true, fanvueContentId: true, name: true, type: true } });
  const ordered = parsed.data.ids.flatMap((id) => { const item = records.find((record) => record.id === id); return item?.fanvueContentId ? [item] : []; });
  if (!ordered.length) return NextResponse.json({ error: "No hay archivos descargables en esta selección." }, { status: 409 });
  const token = await getValidFanvueAccessToken(creatorId);
  const media = await fanvueRequest(`/v1/media/bulk?mediaUuids=${encodeURIComponent(ordered.map((item) => item.fanvueContentId).join(","))}&variants=main`, token, mediaBulkSchema);
  const sources = (await Promise.all(ordered.map(async (record, index) => {
    const item = record.fanvueContentId ? media.results[record.fanvueContentId] : null;
    const url = item?.variants.find((variant) => variant.variantType === "main" && variant.url)?.url ?? item?.variants.find((variant) => variant.url)?.url;
    if (!url) return null;
    const extension = record.name.includes(".") ? "" : record.type === "video" ? ".mp4" : ".jpg";
    const name = `${record.type === "video" ? "Videos" : "Photos"}/${String(index + 1).padStart(3, "0")}-${safe(record.name)}${extension}`;
    let size: number | null = null;
    try { const head = await fetch(url, { method: "HEAD" }); const length = Number(head.headers.get("content-length")); if (Number.isFinite(length) && length >= 0) size = length; } catch { /* Progress remains indeterminate. */ }
    return { name, url, size };
  }))).filter((source): source is NonNullable<typeof source> => Boolean(source));
  if (!sources.length) return NextResponse.json({ error: "Fanvue no proporcionó archivos descargables." }, { status: 409 });
  const length = zipContentLength(sources);
  if (length !== null && length > 2_000_000_000) return NextResponse.json({ error: "La selección supera 2 GB. Descárgala en varios grupos para evitar que el navegador se quede sin memoria." }, { status: 413 });
  return new Response(createZipStream(sources), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safe(parsed.data.filename))}.zip`, ...(length !== null ? { "Content-Length": String(length) } : {}), "X-File-Count": String(sources.length), "Cache-Control": "private, no-store" } });
}
