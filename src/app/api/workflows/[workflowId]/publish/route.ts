import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export async function POST(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const workflow = await prisma.workflow.findFirst({
    where: { id: (await params).workflowId, creatorId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!workflow) return Response.json({ error: "Flujo no encontrado." }, { status: 404 });
  if (workflow.status !== "DRAFT") return Response.json({ error: "El flujo ya fue publicado." }, { status: 409 });
  if (!workflow.steps.length || workflow.steps.at(-1)?.type !== "END") {
    return Response.json({ error: "El flujo debe terminar con el paso Finalizar." }, { status: 400 });
  }
  const published = await prisma.workflow.update({
    where: { id: workflow.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  return Response.json({ workflow: published });
}
