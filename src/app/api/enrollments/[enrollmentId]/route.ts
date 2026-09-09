import { cookies } from "next/headers";
import { z } from "zod";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { transitionEnrollment } from "@/services/workflows/manage-enrollment";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({ action: z.enum(["pause", "resume", "cancel"]), reason: z.string().trim().max(250).optional() });

export async function GET(_request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const enrollment = await prisma.workflowEnrollment.findFirst({
    where: { id: (await params).enrollmentId, creatorId },
    select: {
      id: true, status: true, startedAt: true, completedAt: true, cancelledAt: true, pauseReason: true, cancellationReason: true,
      fan: { select: { displayName: true, username: true } },
      workflow: { select: { name: true, version: true } },
      logs: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true, eventType: true, level: true, explanation: true, reasonCode: true, occurredAt: true, metadata: true,
          execution: { select: { step: { select: { name: true, messageTemplate: { select: { name: true } } } } } },
        },
      },
    },
  });
  if (!enrollment) return Response.json({ error: "El historial de esta ejecución no existe." }, { status: 404 });
  return Response.json({
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      fanName: enrollment.fan.displayName || enrollment.fan.username || "Fan sin nombre",
      fanUsername: enrollment.fan.username,
      workflowName: enrollment.workflow.name,
      workflowVersion: enrollment.workflow.version,
      startedAt: enrollment.startedAt.toISOString(),
      endedAt: (enrollment.completedAt ?? enrollment.cancelledAt)?.toISOString() ?? null,
      pauseReason: enrollment.pauseReason,
      cancellationReason: enrollment.cancellationReason,
      logs: enrollment.logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        level: log.level,
        explanation: log.explanation,
        reasonCode: log.reasonCode,
        occurredAt: log.occurredAt.toISOString(),
        stepName: log.execution?.step.name ?? null,
        templateName: log.execution?.step.messageTemplate?.name ?? null,
        detail: historyDetail(log.metadata),
      })),
    },
  });
}

function historyDetail(metadata: unknown) {
  if (typeof metadata !== "object" || !metadata || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  if (typeof value.error === "string") return `Error: ${value.error}`;
  if (typeof value.matched === "boolean") return `Resultado de la condición: ${value.matched ? "sí cumple" : "no cumple"}.`;
  if (typeof value.amountMinor === "number") return `Importe confirmado: $${(value.amountMinor / 100).toFixed(2)} USD.`;
  if (typeof value.autoResumeAt === "string") return `Reanudación programada: ${new Date(value.autoResumeAt).toLocaleString("es-MX")}.`;
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Acción de enrollment inválida." }, { status: 400 });
  try {
    const enrollment = await transitionEnrollment(creatorId, (await params).enrollmentId, input.data.action, input.data.reason);
    return Response.json({ enrollment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cambiar el enrollment.";
    return Response.json({ error: message }, { status: message === "ENROLLMENT_NOT_FOUND" ? 404 : 409 });
  }
}
