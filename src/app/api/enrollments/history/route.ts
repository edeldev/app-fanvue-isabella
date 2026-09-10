import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const pageSize = 20;
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(100).default(""),
  workflowId: z.string().trim().default(""),
  status: z.enum(["", "ACTIVE", "WAITING", "PAUSED", "COMPLETED", "CANCELLED", "FAILED"]).default(""),
});

export async function GET(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const url = new URL(request.url);
  const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return Response.json({ error: "Filtros de historial inválidos." }, { status: 400 });

  const { page, search, workflowId, status } = query.data;
  const where = {
    creatorId,
    ...(workflowId ? { workflowId } : {}),
    ...(status ? { status } : {}),
    ...(search ? { fan: { OR: [
      { displayName: { contains: search, mode: "insensitive" as const } },
      { username: { contains: search, mode: "insensitive" as const } },
    ] } } : {}),
  };
  const total = await prisma.workflowEnrollment.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  const records = await prisma.workflowEnrollment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true, status: true, startedAt: true, completedAt: true, cancelledAt: true,
      fan: { select: { displayName: true, username: true } },
      workflow: { select: { name: true } },
    },
  });

  return Response.json({
    entries: records.map((entry) => ({
      id: entry.id,
      status: entry.status,
      fanName: entry.fan.displayName || entry.fan.username || "Fan sin nombre",
      fanUsername: entry.fan.username,
      workflowName: entry.workflow.name,
      startedAt: entry.startedAt.toISOString(),
      endedAt: (entry.completedAt ?? entry.cancelledAt)?.toISOString() ?? null,
    })),
    pagination: { page: currentPage, pageSize, total, pages },
  });
}
