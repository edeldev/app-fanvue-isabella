import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const packTypes = ["PHOTO_PACK", "VIDEO_PACK", "PHOTO_VIDEO", "PPV", "SUBSCRIBER", "PREMIUM", "BUNDLE", "CUSTOM"] as const;
const createSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).optional(), type: z.enum(packTypes), categoryId: z.string().nullable().optional(), priceMinor: z.number().int().min(0).nullable().optional(), contentIds: z.array(z.string()).max(500).default([]) });
const duplicateSchema = z.object({ action: z.literal("duplicate"), id: z.string().min(1) });

async function owner() { return readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value); }

export async function GET() {
  const creatorId = await owner();
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [packs, categories, assets] = await Promise.all([
    prisma.contentPack.findMany({ where: { creatorId }, orderBy: { updatedAt: "desc" }, include: { category: { select: { id: true, name: true } }, cover: { select: { id: true, name: true, fanvueContentId: true, type: true } }, assets: { orderBy: { position: "asc" }, include: { content: { select: { id: true, name: true, type: true, fanvueContentId: true } } } } } }),
    prisma.contentCategory.findMany({ where: { creatorId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.content.findMany({ where: { creatorId, isArchived: false }, orderBy: { createdAt: "desc" }, take: 500, select: { id: true, name: true, type: true, fanvueContentId: true } }),
  ]);
  const mediaUuids = [...new Set(assets.flatMap((asset) => asset.fanvueContentId ? [asset.fanvueContentId] : []))];
  const mediaUrls = new Map<string, { url?: string; thumbnailUrl?: string }>();
  if (mediaUuids.length) {
    try {
      const token = await getValidFanvueAccessToken(creatorId);
      for (let index = 0; index < mediaUuids.length; index += 20) {
        const chunk = mediaUuids.slice(index, index + 20);
        try {
          const resolved = await fanvueRequest(`/v1/media/bulk?mediaUuids=${encodeURIComponent(chunk.join(","))}&variants=thumbnail,main`, token, mediaBulkSchema);
          for (const item of Object.values(resolved.results)) {
            if (!item || item.status !== "ready") continue;
            const main = item.variants.find((variant) => variant.variantType === "main" && variant.url) ?? item.variants.find((variant) => variant.url);
            const thumbnail = item.variants.find((variant) => variant.variantType === "thumbnail" && variant.url) ?? item.variants.find((variant) => variant.variantType === "thumbnail_gallery" && variant.url);
            mediaUrls.set(item.uuid, { url: main?.url ?? thumbnail?.url, thumbnailUrl: thumbnail?.url ?? (item.mediaType !== "video" ? main?.url : undefined) });
          }
        } catch { /* Other chunks can still provide useful previews. */ }
      }
    } catch { /* Pack cards remain usable without a cover preview. */ }
  }
  const withPreview = <T extends { fanvueContentId: string | null }>(asset: T) => ({ ...asset, ...(asset.fanvueContentId ? mediaUrls.get(asset.fanvueContentId) : {}) });
  return NextResponse.json({ packs: packs.map((pack) => ({ ...pack, coverUrl: pack.cover?.fanvueContentId ? (mediaUrls.get(pack.cover.fanvueContentId)?.thumbnailUrl ?? mediaUrls.get(pack.cover.fanvueContentId)?.url) : undefined, priceMinor: pack.priceMinor, assets: pack.assets.map((item) => ({ ...withPreview(item.content), position: item.position })), stats: { total: pack.assets.length, photos: pack.assets.filter((item) => item.content.type === "image").length, videos: pack.assets.filter((item) => item.content.type === "video").length } })), categories, assets: assets.map(withPreview) });
}

export async function POST(request: Request) {
  const creatorId = await owner();
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const duplicate = duplicateSchema.safeParse(body);
  if (duplicate.success) {
    const source = await prisma.contentPack.findFirst({ where: { id: duplicate.data.id, creatorId }, include: { assets: { orderBy: { position: "asc" } } } });
    if (!source) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    const copy = await prisma.contentPack.create({ data: { creatorId, name: `${source.name} — copia ${Date.now().toString().slice(-4)}`, description: source.description, type: source.type, status: "DRAFT", categoryId: source.categoryId, priceMinor: source.priceMinor, coverContentId: source.coverContentId, assets: { create: source.assets.map((item) => ({ contentId: item.contentId, position: item.position })) } } });
    return NextResponse.json({ pack: copy }, { status: 201 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos del Pack inválidos" }, { status: 400 });
  const allowed = await prisma.content.findMany({ where: { creatorId, id: { in: parsed.data.contentIds } }, select: { id: true } });
  const pack = await prisma.contentPack.create({ data: { creatorId, name: parsed.data.name, description: parsed.data.description || null, type: parsed.data.type, categoryId: parsed.data.categoryId || null, priceMinor: parsed.data.priceMinor ?? null, coverContentId: allowed[0]?.id ?? null, assets: { create: allowed.map((item, position) => ({ contentId: item.id, position })) } } });
  return NextResponse.json({ pack }, { status: 201 });
}
