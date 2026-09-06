import type { EnrollmentStatus, Prisma } from "@/generated/prisma/client";
import { assertEnrollmentTransition } from "@/domain/automation/transitions";
import { prisma } from "@/lib/prisma";

const nonTerminalStatuses: EnrollmentStatus[] = ["ACTIVE", "WAITING", "PAUSED"];

export async function startEnrollment(creatorId: string, fanId: string, workflowId: string) {
  const [fan, workflow] = await Promise.all([
    prisma.fan.findFirst({ where: { id: fanId, creatorId, isCreatorAccount: false } }),
    prisma.workflow.findFirst({ where: { id: workflowId, creatorId, status: "PUBLISHED", isPrimary: true }, include: { steps: { orderBy: { position: "asc" }, take: 1 } } }),
  ]);
  if (!fan) throw new Error("ENROLLMENT_FAN_NOT_FOUND");
  if (!workflow || !workflow.steps[0]) throw new Error("ENROLLMENT_WORKFLOW_NOT_FOUND");

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.workflowEnrollment.findFirst({
      where: { creatorId, fanId, isPrimary: true, status: { in: nonTerminalStatuses } },
      include: { workflow: { select: { name: true } } },
    });
    if (current?.workflowId === workflowId) throw new Error("ENROLLMENT_ALREADY_ACTIVE");
    if (current) {
      assertEnrollmentTransition(current.status, "CANCELLED");
      await transaction.workflowEnrollment.update({
        where: { id: current.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), nextRunAt: null, cancellationReason: `Reemplazado manualmente por ${workflow.name}.`, lockedAt: null, lockOwner: null, lockExpiresAt: null },
      });
      await transaction.automationLog.create({ data: { creatorId, fanId, enrollmentId: current.id, eventType: "WORKFLOW_CHANGED", explanation: `${current.workflow.name} fue reemplazado por ${workflow.name}.`, metadata: { fromWorkflowId: current.workflowId, toWorkflowId: workflowId } satisfies Prisma.InputJsonValue } });
    }
    const enrollment = await transaction.workflowEnrollment.create({
      data: { creatorId, fanId, workflowId, currentStepId: workflow.steps[0].id, status: "ACTIVE", isPrimary: true, nextRunAt: null },
    });
    await transaction.automationLog.create({ data: { creatorId, fanId, enrollmentId: enrollment.id, eventType: "WORKFLOW_ASSIGNED", explanation: `${workflow.name} fue asignado y está listo para iniciar en ${workflow.steps[0].name}.`, metadata: { workflowId, firstStepId: workflow.steps[0].id } satisfies Prisma.InputJsonValue } });
    return enrollment;
  });
}

export type EnrollmentAction = "pause" | "resume" | "cancel";

export async function transitionEnrollment(creatorId: string, enrollmentId: string, action: EnrollmentAction, reason?: string) {
  const enrollment = await prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, creatorId }, include: { workflow: { select: { name: true } } },
  });
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");
  const target: EnrollmentStatus = action === "pause" ? "PAUSED" : action === "resume" ? "ACTIVE" : "CANCELLED";
  assertEnrollmentTransition(enrollment.status, target);
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.workflowEnrollment.update({
      where: { id: enrollment.id },
      data: action === "pause"
        ? { status: target, pausedAt: now, pauseReason: reason || "Pausado manualmente.", nextRunAt: null }
        : action === "resume"
          ? { status: target, pausedAt: null, pauseReason: null, nextRunAt: now }
          : { status: target, cancelledAt: now, cancellationReason: reason || "Cancelado manualmente.", nextRunAt: null, lockedAt: null, lockOwner: null, lockExpiresAt: null },
    });
    const eventType = action === "pause" ? "WORKFLOW_PAUSED" : action === "resume" ? "WORKFLOW_RESUMED" : "WORKFLOW_CANCELLED";
    await transaction.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, eventType, explanation: `${enrollment.workflow.name}: ${reason || (action === "pause" ? "pausado manualmente." : action === "resume" ? "reanudado manualmente." : "cancelado manualmente.")}` } });
    return updated;
  });
}
