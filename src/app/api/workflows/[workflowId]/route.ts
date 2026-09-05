import { cookies } from "next/headers";
import { ZodError } from "zod";
import { canDeleteWorkflow } from "@/domain/workflows/deletion-policy";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { updateWorkflow } from "@/services/workflows/save-workflow";

async function sessionCreatorId() {
  return readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
}

export async function PUT(request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const creatorId = await sessionCreatorId();
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  try {
    const workflow = await updateWorkflow(creatorId, (await params).workflowId, await request.json());
    return Response.json({ workflow });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Flujo inválido." }, { status: 400 });
    const message = error instanceof Error ? error.message : "No se pudo actualizar el flujo.";
    return Response.json({ error: message }, { status: message === "WORKFLOW_NOT_FOUND" ? 404 : 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const creatorId = await sessionCreatorId();
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const workflow = await prisma.workflow.findFirst({
    where: { id: (await params).workflowId, creatorId },
  });
  if (!workflow) return Response.json({ error: "Flujo no encontrado." }, { status: 404 });
  const activeEnrollments = await prisma.workflowEnrollment.count({
    where: { workflowId: workflow.id, creatorId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
  });
  if (!canDeleteWorkflow(workflow.status, { activeEnrollments })) {
    return Response.json({ error: "WORKFLOW_IS_RUNNING" }, { status: 409 });
  }
  await prisma.$transaction(async (transaction) => {
    if (workflow.status === "PUBLISHED") {
      await transaction.workflowEnrollment.deleteMany({ where: { workflowId: workflow.id, creatorId } });
    }
    await transaction.workflow.delete({ where: { id: workflow.id } });
  });
  return new Response(null, { status: 204 });
}
