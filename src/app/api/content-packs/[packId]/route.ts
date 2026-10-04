import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const statuses = ["DRAFT", "READY", "ACTIVE", "ARCHIVED"] as const;
const types = ["PHOTO_PACK", "VIDEO_PACK", "PHOTO_VIDEO", "PPV", "SUBSCRIBER", "PREMIUM", "BUNDLE", "CUSTOM"] as const;
const updateSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).nullable(), type: z.enum(types), status: z.enum(statuses), categoryId: z.string().nullable(), priceMinor: z.number().int().min(0).nullable(), coverContentId: z.string().nullable(), contentIds: z.array(z.string()).max(500) });

async function owner() { return readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value); }

export async function PATCH(request: Request, { params }: { params: Promise<{ packId: string }> }) {
  const creatorId = await owner();
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { packId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos del Pack inválidos" }, { status: 400 });
  const pack = await prisma.contentPack.findFirst({ where: { id: packId, creatorId }, select: { id: true } });
  if (!pack) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
  const assets = await prisma.content.findMany({ where: { creatorId, id: { in: parsed.data.contentIds } }, select: { id: true } });
  const ordered = parsed.data.contentIds.flatMap((id) => assets.some((asset) => asset.id === id) ? [id] : []);
  const coverContentId = parsed.data.coverContentId && ordered.includes(parsed.data.coverContentId) ? parsed.data.coverContentId : ordered[0] ?? null;
  if (parsed.data.categoryId && !await prisma.contentCategory.findFirst({ where: { id: parsed.data.categoryId, creatorId } })) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  await prisma.$transaction(async (transaction) => {
    await transaction.contentPackAsset.deleteMany({ where: { packId } });
    if (ordered.length) await transaction.contentPackAsset.createMany({ data: ordered.map((contentId, position) => ({ packId, contentId, position })) });
    await transaction.contentPack.update({ where: { id: packId }, data: { name: parsed.data.name, description: parsed.data.description, type: parsed.data.type, status: parsed.data.status, categoryId: parsed.data.categoryId, priceMinor: parsed.data.priceMinor, coverContentId } });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ packId: string }> }) {
  const creatorId = await owner();
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { packId } = await params;
  const deleted = await prisma.contentPack.deleteMany({ where: { id: packId, creatorId } });
  if (!deleted.count) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
