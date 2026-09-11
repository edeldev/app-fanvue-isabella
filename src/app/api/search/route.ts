import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export async function GET(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const [fans, templates, workflows] = await Promise.all([
    prisma.fan.findMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { lastActivityAt: "desc" },
      take: 6,
      select: { id: true, fanvueUserId: true, displayName: true, username: true, avatarUrl: true },
    }),
    prisma.messageTemplate.findMany({
      where: { creatorId, OR: [{ name: { contains: query, mode: "insensitive" } }, { text: { contains: query, mode: "insensitive" } }] },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, category: true },
    }),
    prisma.workflow.findMany({
      where: { creatorId, name: { contains: query, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
  ]);

  return NextResponse.json({
    results: [
      ...fans.map((fan) => ({ id: `fan:${fan.id}`, type: "fan", title: fan.displayName || fan.username || "Fan sin nombre", subtitle: `@${fan.username || "sin-usuario"}`, href: `/messages?fan=${encodeURIComponent(fan.fanvueUserId)}`, avatarUrl: fan.avatarUrl })),
      ...templates.map((template) => ({ id: `template:${template.id}`, type: "template", title: template.name, subtitle: `Plantilla · ${template.category}`, href: `/templates#template-${template.id}` })),
      ...workflows.map((workflow) => ({ id: `workflow:${workflow.id}`, type: "workflow", title: workflow.name, subtitle: `Workflow · ${workflow.status === "PUBLISHED" ? "Publicado" : workflow.status === "DRAFT" ? "Borrador" : "Archivado"}`, href: `/workflows?q=${encodeURIComponent(workflow.name)}` })),
    ],
  });
}
