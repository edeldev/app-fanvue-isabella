import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const mediaSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  mediaType: z.enum(["image", "video"]),
  createdAt: z.string().datetime().nullable().optional(),
});
const importSchema = z.object({ action: z.literal("import"), media: z.array(mediaSchema).min(1).max(100) });
const createOrganizerSchema = z.object({ action: z.enum(["createCategory", "createCollection", "createTag"]), name: z.string().trim().min(2).max(80) });
const addToPackSchema = z.object({ action: z.literal("addToPack"), packId: z.string().min(1), contentIds: z.array(z.string()).min(1).max(5000) });
const bulkDeleteSchema = z.object({ action: z.literal("bulkDelete"), contentIds: z.array(z.string()).min(1).max(5000) });
const bulkOrganizeSchema = z.object({
  action: z.literal("bulkOrganize"),
  contentIds: z.array(z.string()).min(1).max(5000),
  categoryId: z.string().nullable().optional(),
  collections: z.object({ mode: z.enum(["add", "replace", "remove"]), ids: z.array(z.string()).max(50) }).optional(),
  tags: z.object({ mode: z.enum(["add", "replace", "remove"]), ids: z.array(z.string()).max(50) }).optional(),
});
const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(240).optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  categoryId: z.string().nullable().optional(),
  collectionIds: z.array(z.string()).max(50).optional(),
  tagIds: z.array(z.string()).max(50).optional(),
  addCollectionIds: z.array(z.string()).max(50).optional(),
  addTagIds: z.array(z.string()).max(50).optional(),
});

async function creatorId() {
  return readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
}

function metadata(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  const ownerId = await creatorId();
  if (!ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const input = new URL(request.url).searchParams;
  const page = Math.max(1, Number(input.get("page") || 1));
  const pageSize = Math.min(60, Math.max(12, Number(input.get("pageSize") || 30)));
  const query = input.get("q")?.trim().slice(0, 80) ?? "";
  const view = input.get("view") ?? "all";
  const categoryId = input.get("category") ?? "";
  const collectionId = input.get("collection") ?? "";
  const tagId = input.get("tag") ?? "";
  const packId = input.get("pack") ?? "";
  const assetId = input.get("asset") ?? "";
  const where = {
    creatorId: ownerId,
    ...(assetId ? { id: assetId } : {}),
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { category: { name: { contains: query, mode: "insensitive" as const } } },
      { collections: { some: { collection: { name: { contains: query, mode: "insensitive" as const } } } } },
      { tags: { some: { tag: { name: { contains: query, mode: "insensitive" as const } } } } },
      { packItems: { some: { pack: { name: { contains: query, mode: "insensitive" as const } } } } },
    ] } : {}),
    ...(view === "photos" ? { type: "image" } : view === "videos" ? { type: "video" } : {}),
    ...(view === "favorites" ? { isFavorite: true } : {}),
    ...(view === "unused" ? { packItems: { none: {} } } : {}),
    ...(view === "used" ? { packItems: { some: {} } } : {}),
    ...(view === "unorganized" ? { categoryId: null, collections: { none: {} }, tags: { none: {} } } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(collectionId ? { collections: { some: { collectionId } } } : {}),
    ...(tagId ? { tags: { some: { tagId } } } : {}),
    ...(packId ? { packItems: { some: { packId } } } : {}),
    isArchived: view === "archived",
  };
  if (input.get("idsOnly") === "1") {
    const records = await prisma.content.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true }, take: 5000 });
    return NextResponse.json({ ids: records.map((item) => item.id), limited: records.length === 5000 });
  }
  const [records, total, photos, videos, favorites, archived, categories, collections, tags, packs, unorganized, unused, used] = await Promise.all([
    prisma.content.findMany({ where, include: { category: { select: { id: true, name: true } }, collections: { include: { collection: { select: { id: true, name: true } } } }, tags: { include: { tag: { select: { id: true, name: true } } } }, packItems: { include: { pack: { select: { id: true, name: true, status: true } } }, orderBy: { position: "asc" } }, templates: { select: { id: true, name: true } }, templateItems: { include: { template: { select: { id: true, name: true } } }, orderBy: { position: "asc" } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.content.count({ where }),
    prisma.content.count({ where: { creatorId: ownerId, type: "image", isArchived: false } }),
    prisma.content.count({ where: { creatorId: ownerId, type: "video", isArchived: false } }),
    prisma.content.count({ where: { creatorId: ownerId, isFavorite: true, isArchived: false } }),
    prisma.content.count({ where: { creatorId: ownerId, isArchived: true } }),
    prisma.contentCategory.findMany({ where: { creatorId: ownerId }, orderBy: { name: "asc" }, include: { _count: { select: { assets: true } } } }),
    prisma.contentCollection.findMany({ where: { creatorId: ownerId }, orderBy: { name: "asc" }, include: { _count: { select: { assets: true } } } }),
    prisma.contentTag.findMany({ where: { creatorId: ownerId }, orderBy: { name: "asc" }, include: { _count: { select: { assets: true } } } }),
    prisma.contentPack.findMany({ where: { creatorId: ownerId }, orderBy: { name: "asc" }, include: { _count: { select: { assets: true } } } }),
    prisma.content.count({ where: { creatorId: ownerId, isArchived: false, categoryId: null, collections: { none: {} }, tags: { none: {} } } }),
    prisma.content.count({ where: { creatorId: ownerId, isArchived: false, packItems: { none: {} } } }),
    prisma.content.count({ where: { creatorId: ownerId, isArchived: false, packItems: { some: {} } } }),
  ]);
  const uuids = records.flatMap((item) => item.fanvueContentId ? [item.fanvueContentId] : []);
  const urls = new Map<string, { url?: string; thumbnailUrl?: string; width?: number | null; height?: number | null; durationMs?: number | null }>();
  if (uuids.length) {
    try {
      const token = await getValidFanvueAccessToken(ownerId);
      const resolved = await fanvueRequest(`/v1/media/bulk?mediaUuids=${encodeURIComponent(uuids.join(","))}&variants=main,thumbnail`, token, mediaBulkSchema);
      for (const item of Object.values(resolved.results)) {
        if (!item || item.status !== "ready") continue;
        const main = item.variants.find((variant) => variant.variantType === "main" && variant.url) ?? item.variants.find((variant) => variant.url);
        const thumbnail = item.variants.find((variant) => variant.variantType === "thumbnail" && variant.url) ?? item.variants.find((variant) => variant.variantType === "thumbnail_gallery" && variant.url);
        const detail = main ?? thumbnail;
        urls.set(item.uuid, { url: main?.url ?? thumbnail?.url, thumbnailUrl: thumbnail?.url, width: typeof detail?.width === "number" ? detail.width : null, height: typeof detail?.height === "number" ? detail.height : null, durationMs: typeof detail?.lengthMs === "number" ? detail.lengthMs : null });
      }
    } catch { /* Assets remain visible and can be resolved again on refresh. */ }
  }
  return NextResponse.json({
    items: records.map((item) => ({ id: item.id, uuid: item.fanvueContentId, name: item.name, mediaType: item.type, isFavorite: item.isFavorite, isArchived: item.isArchived, createdAt: item.createdAt.toISOString(), category: item.category, collections: item.collections.map((entry) => entry.collection), tags: item.tags.map((entry) => entry.tag), packs: item.packItems.map((entry) => entry.pack), templates: [...new Map([...item.templates, ...item.templateItems.map((entry) => entry.template)].map((template) => [template.id, template])).values()], ...metadata(item.metadata), ...(item.fanvueContentId ? urls.get(item.fanvueContentId) : {}) })),
    pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
    counts: { all: photos + videos, photos, videos, favorites, archived, unorganized, unused, used },
    organizers: { categories: categories.map((item) => ({ id: item.id, name: item.name, count: item._count.assets })), collections: collections.map((item) => ({ id: item.id, name: item.name, count: item._count.assets })), tags: tags.map((item) => ({ id: item.id, name: item.name, count: item._count.assets })), packs: packs.map((item) => ({ id: item.id, name: item.name, count: item._count.assets })) },
  });
}

export async function POST(request: Request) {
  const ownerId = await creatorId();
  if (!ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const bulkDelete = bulkDeleteSchema.safeParse(body);
  if (bulkDelete.success) {
    const deleted = await prisma.content.deleteMany({ where: { creatorId: ownerId, id: { in: bulkDelete.data.contentIds } } });
    return NextResponse.json({ deleted: deleted.count });
  }
  const bulkOrganize = bulkOrganizeSchema.safeParse(body);
  if (bulkOrganize.success) {
    const { contentIds, categoryId, collections, tags } = bulkOrganize.data;
    const result = await prisma.$transaction(async (transaction) => {
      const allowedAssets = await transaction.content.findMany({ where: { creatorId: ownerId, id: { in: contentIds } }, select: { id: true } });
      const assetIds = allowedAssets.map((item) => item.id);
      if (!assetIds.length) return { updated: 0 };

      if (categoryId !== undefined) {
        if (categoryId && !await transaction.contentCategory.findFirst({ where: { id: categoryId, creatorId: ownerId }, select: { id: true } })) throw new Error("INVALID_CATEGORY");
        await transaction.content.updateMany({ where: { id: { in: assetIds } }, data: { categoryId } });
      }

      if (collections) {
        const allowed = collections.ids.length ? await transaction.contentCollection.findMany({ where: { creatorId: ownerId, id: { in: collections.ids } }, select: { id: true } }) : [];
        const organizerIds = allowed.map((item) => item.id);
        if (collections.mode === "replace") await transaction.contentCollectionAsset.deleteMany({ where: { contentId: { in: assetIds } } });
        if (collections.mode === "remove") await transaction.contentCollectionAsset.deleteMany({ where: { contentId: { in: assetIds }, ...(organizerIds.length ? { collectionId: { in: organizerIds } } : {}) } });
        if (collections.mode !== "remove" && organizerIds.length) await transaction.contentCollectionAsset.createMany({ data: assetIds.flatMap((contentId) => organizerIds.map((collectionId) => ({ contentId, collectionId }))), skipDuplicates: true });
      }

      if (tags) {
        const allowed = tags.ids.length ? await transaction.contentTag.findMany({ where: { creatorId: ownerId, id: { in: tags.ids } }, select: { id: true } }) : [];
        const organizerIds = allowed.map((item) => item.id);
        if (tags.mode === "replace") await transaction.contentAssetTag.deleteMany({ where: { contentId: { in: assetIds } } });
        if (tags.mode === "remove") await transaction.contentAssetTag.deleteMany({ where: { contentId: { in: assetIds }, ...(organizerIds.length ? { tagId: { in: organizerIds } } : {}) } });
        if (tags.mode !== "remove" && organizerIds.length) await transaction.contentAssetTag.createMany({ data: assetIds.flatMap((contentId) => organizerIds.map((tagId) => ({ contentId, tagId }))), skipDuplicates: true });
      }
      return { updated: assetIds.length };
    }).catch((error: unknown) => error instanceof Error && error.message === "INVALID_CATEGORY" ? null : Promise.reject(error));
    if (!result) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    return NextResponse.json(result);
  }
  const addToPack = addToPackSchema.safeParse(body);
  if (addToPack.success) {
    const result = await prisma.$transaction(async (transaction) => {
      const pack = await transaction.contentPack.findFirst({ where: { id: addToPack.data.packId, creatorId: ownerId }, select: { id: true } });
      if (!pack) return null;
      const [allowed, existing, last] = await Promise.all([
        transaction.content.findMany({ where: { creatorId: ownerId, id: { in: addToPack.data.contentIds } }, select: { id: true } }),
        transaction.contentPackAsset.findMany({ where: { packId: pack.id, contentId: { in: addToPack.data.contentIds } }, select: { contentId: true } }),
        transaction.contentPackAsset.aggregate({ where: { packId: pack.id }, _max: { position: true } }),
      ]);
      const existingIds = new Set(existing.map((item) => item.contentId));
      const contentIds = addToPack.data.contentIds.filter((id) => allowed.some((item) => item.id === id) && !existingIds.has(id));
      if (contentIds.length) await transaction.contentPackAsset.createMany({ data: contentIds.map((contentId, index) => ({ packId: pack.id, contentId, position: (last._max.position ?? -1) + index + 1 })) });
      return { added: contentIds.length, alreadyPresent: existing.length };
    });
    if (!result) return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    return NextResponse.json(result);
  }
  const organizer = createOrganizerSchema.safeParse(body);
  if (organizer.success) {
    const data = { creatorId: ownerId, name: organizer.data.name };
    const item = organizer.data.action === "createCategory" ? await prisma.contentCategory.create({ data }) : organizer.data.action === "createCollection" ? await prisma.contentCollection.create({ data }) : await prisma.contentTag.create({ data });
    return NextResponse.json({ item }, { status: 201 });
  }
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Contenido inválido" }, { status: 400 });
  const stored = await prisma.$transaction(parsed.data.media.map((item) => prisma.content.upsert({
    where: { creatorId_fanvueContentId: { creatorId: ownerId, fanvueContentId: item.uuid } },
    update: { name: item.name, type: item.mediaType, isArchived: false },
    create: { creatorId: ownerId, fanvueContentId: item.uuid, name: item.name, type: item.mediaType, metadata: { source: "FANVUE_REFERENCE", importedAt: new Date().toISOString(), sourceCreatedAt: item.createdAt ?? null } },
  })));
  return NextResponse.json({ imported: stored.length }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ownerId = await creatorId();
  if (!ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cambios inválidos" }, { status: 400 });
  const { id, collectionIds, tagIds, addCollectionIds, addTagIds, ...data } = parsed.data;
  const asset = await prisma.content.findFirst({ where: { id, creatorId: ownerId }, select: { id: true } });
  if (!asset) return NextResponse.json({ error: "Contenido no encontrado" }, { status: 404 });
  if (data.categoryId && !await prisma.contentCategory.findFirst({ where: { id: data.categoryId, creatorId: ownerId } })) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  await prisma.$transaction(async (transaction) => {
    await transaction.content.update({ where: { id }, data });
    if (collectionIds) {
      const allowed = await transaction.contentCollection.findMany({ where: { creatorId: ownerId, id: { in: collectionIds } }, select: { id: true } });
      await transaction.contentCollectionAsset.deleteMany({ where: { contentId: id } });
      if (allowed.length) await transaction.contentCollectionAsset.createMany({ data: allowed.map((item) => ({ contentId: id, collectionId: item.id })) });
    }
    if (tagIds) {
      const allowed = await transaction.contentTag.findMany({ where: { creatorId: ownerId, id: { in: tagIds } }, select: { id: true } });
      await transaction.contentAssetTag.deleteMany({ where: { contentId: id } });
      if (allowed.length) await transaction.contentAssetTag.createMany({ data: allowed.map((item) => ({ contentId: id, tagId: item.id })) });
    }
    if (addCollectionIds?.length) {
      const allowed = await transaction.contentCollection.findMany({ where: { creatorId: ownerId, id: { in: addCollectionIds } }, select: { id: true } });
      if (allowed.length) await transaction.contentCollectionAsset.createMany({ data: allowed.map((item) => ({ contentId: id, collectionId: item.id })), skipDuplicates: true });
    }
    if (addTagIds?.length) {
      const allowed = await transaction.contentTag.findMany({ where: { creatorId: ownerId, id: { in: addTagIds } }, select: { id: true } });
      if (allowed.length) await transaction.contentAssetTag.createMany({ data: allowed.map((item) => ({ contentId: id, tagId: item.id })), skipDuplicates: true });
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ownerId = await creatorId();
  if (!ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Contenido inválido" }, { status: 400 });
  const deleted = await prisma.content.deleteMany({ where: { id, creatorId: ownerId } });
  if (!deleted.count) return NextResponse.json({ error: "Contenido no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
