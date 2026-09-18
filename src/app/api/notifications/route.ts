import { cookies } from "next/headers";
import { engagementCopy, engagementEventTypes, type EngagementEventType } from "@/domain/notifications/engagement";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export async function GET(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });

  const cursorAt = new Date();
  const url = new URL(request.url);
  const afterValue = url.searchParams.get("after");
  const after = afterValue ? new Date(afterValue) : null;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
  const records = await prisma.fanEvent.findMany({
    where: {
      creatorId,
      type: { in: [...engagementEventTypes] },
      ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}),
    },
    include: { fan: { select: { displayName: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return Response.json({
    cursor: cursorAt.toISOString(),
    notifications: records.reverse().map((record) => {
      const type = record.type as EngagementEventType;
      const actorName = record.fan?.displayName || record.fan?.username || "Un fan";
      const copy = engagementCopy(type, actorName, record.payload);
      const payload = typeof record.payload === "object" && record.payload !== null && !Array.isArray(record.payload)
        ? record.payload as Record<string, unknown>
        : {};
      return {
        id: record.id,
        type,
        ...copy,
        actorName,
        actorUsername: record.fan?.username ?? null,
        avatarUrl: record.fan?.avatarUrl ?? null,
        postUuid: typeof payload.postUuid === "string" ? payload.postUuid : null,
        occurredAt: record.occurredAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
      };
    }),
  });
}

export async function DELETE() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });

  const result = await prisma.fanEvent.deleteMany({
    where: {
      creatorId,
      type: { in: [...engagementEventTypes] },
    },
  });

  return Response.json({ ok: true, deleted: result.count });
}
