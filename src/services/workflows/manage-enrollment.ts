import type { EnrollmentStatus, Prisma } from "@/generated/prisma/client";
import { assertEnrollmentTransition } from "@/domain/automation/transitions";
import { remainingWaitSeconds, resumedRunAt } from "@/domain/workflows/pause-schedule";
import { prisma } from "@/lib/prisma";
import { reentryBlockedReason } from "@/domain/workflows/reentry-policy";
import { isReplyWithinAttributionWindow } from "@/domain/workflows/reply-attribution";

const nonTerminalStatuses: EnrollmentStatus[] = ["ACTIVE", "WAITING", "PAUSED"];

export async function startEnrollment(creatorId: string, fanId: string, workflowId: string) {
  const [fan, workflow] = await Promise.all([
    prisma.fan.findFirst({ where: { id: fanId, creatorId, isCreatorAccount: false } }),
    prisma.workflow.findFirst({ where: { id: workflowId, creatorId, status: "PUBLISHED", isPrimary: true }, include: { steps: { orderBy: { position: "asc" }, take: 1 } } }),
  ]);
  if (!fan) throw new Error("ENROLLMENT_FAN_NOT_FOUND");
  if (!workflow || !workflow.steps[0]) throw new Error("ENROLLMENT_WORKFLOW_NOT_FOUND");

  const result = await prisma.$transaction(async (transaction) => {
    const current = await transaction.workflowEnrollment.findFirst({
      where: { creatorId, fanId, isPrimary: true, status: { in: nonTerminalStatuses } },
      include: { workflow: { select: { name: true } } },
    });
    if (current?.workflowId === workflowId) {
      await transaction.automationLog.create({
        data: { creatorId, fanId, enrollmentId: current.id, eventType: "WORKFLOW_REENTRY_SKIPPED", reasonCode: "ENROLLMENT_ALREADY_ACTIVE", explanation: `${workflow.name}: el fan fue omitido porque ya tiene una ejecución activa de este workflow.`, metadata: { workflowId, reentryPolicy: workflow.reentryPolicy } satisfies Prisma.InputJsonValue },
      });
      return { blockedCode: "ENROLLMENT_ALREADY_ACTIVE", enrollment: null };
    }
    const prior = await transaction.workflowEnrollment.findFirst({
      where: { creatorId, fanId, workflowId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, completedAt: true, cancelledAt: true, updatedAt: true },
    });
    const reentryReferenceAt = prior ? prior.completedAt ?? prior.cancelledAt ?? prior.updatedAt ?? prior.createdAt : null;
    const blocked = reentryBlockedReason(workflow.reentryPolicy, reentryReferenceAt ? { reentryReferenceAt } : null, workflow.reentryDelayDays, new Date());
    if (blocked) {
      const explanation = blocked.code === "WORKFLOW_REENTRY_ONCE"
        ? `${workflow.name}: el fan fue omitido porque este workflow solo puede ejecutarse una vez por fan.`
        : `${workflow.name}: el fan fue omitido; podrá volver a ingresar después del ${blocked.eligibleAt?.toLocaleString("es-MX")}.`;
      await transaction.automationLog.create({
        data: { creatorId, fanId, eventType: "WORKFLOW_REENTRY_SKIPPED", reasonCode: blocked.code, explanation, metadata: { workflowId, reentryPolicy: workflow.reentryPolicy, eligibleAt: blocked.eligibleAt?.toISOString() ?? null } satisfies Prisma.InputJsonValue },
      });
      return { blockedCode: blocked.code, enrollment: null };
    }
    if (current) {
      assertEnrollmentTransition(current.status, "CANCELLED");
      await transaction.workflowEnrollment.update({
        where: { id: current.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), nextRunAt: null, cancellationReason: `Reemplazado manualmente por ${workflow.name}.`, lockedAt: null, lockOwner: null, lockExpiresAt: null },
      });
      await transaction.automationLog.create({ data: { creatorId, fanId, enrollmentId: current.id, eventType: "WORKFLOW_CHANGED", explanation: `${current.workflow.name} fue reemplazado por ${workflow.name}.`, metadata: { fromWorkflowId: current.workflowId, toWorkflowId: workflowId } satisfies Prisma.InputJsonValue } });
    }
    const enrollment = await transaction.workflowEnrollment.create({
      data: { creatorId, fanId, workflowId, currentStepId: workflow.steps[0].id, status: "ACTIVE", isPrimary: true, nextRunAt: null, workflowPath: [workflowId] },
    });
    await transaction.automationLog.create({ data: { creatorId, fanId, enrollmentId: enrollment.id, eventType: "WORKFLOW_ASSIGNED", explanation: `${workflow.name} fue asignado y está listo para iniciar en ${workflow.steps[0].name}.`, metadata: { workflowId, firstStepId: workflow.steps[0].id } satisfies Prisma.InputJsonValue } });
    return { blockedCode: null, enrollment };
  });
  if (result.blockedCode) throw new Error(result.blockedCode);
  if (!result.enrollment) throw new Error("ENROLLMENT_NOT_CREATED");
  return result.enrollment;
}

export type EnrollmentAction = "pause" | "resume" | "cancel";

export async function recordFanReplyInActiveWorkflows(creatorId: string, fanId: string, messageId: string, repliedAt: Date) {
  const enrollments = await prisma.workflowEnrollment.findMany({
    where: { creatorId, fanId, status: { in: [...nonTerminalStatuses, "COMPLETED"] } },
    select: {
      id: true,
      status: true,
      workflow: { select: { name: true, replyAttributionHours: true } },
      logs: {
        where: { eventType: { in: ["WORKFLOW_MESSAGE_SENT", "WORKFLOW_PPV_SENT"] }, occurredAt: { lte: repliedAt } },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
    },
  });
  const enrollment = enrollments
    .filter((candidate) => {
      const lastMessageAt = candidate.logs[0]?.occurredAt;
      if (!lastMessageAt) return false;
      return candidate.status !== "COMPLETED" || isReplyWithinAttributionWindow(repliedAt, lastMessageAt, candidate.workflow.replyAttributionHours);
    })
    .sort((left, right) => right.logs[0].occurredAt.getTime() - left.logs[0].occurredAt.getTime())[0];
  if (!enrollment) return 0;
  const afterCompletion = enrollment.status === "COMPLETED";
  await prisma.automationLog.create({
    data: {
      creatorId,
      fanId,
      enrollmentId: enrollment.id,
      eventType: "WORKFLOW_FAN_REPLIED",
      explanation: `${enrollment.workflow.name}: el fan respondió ${afterCompletion ? "después de finalizar, dentro de la ventana de atribución" : "durante el workflow"}.`,
      metadata: { messageId, repliedAt: repliedAt.toISOString(), lastWorkflowMessageAt: enrollment.logs[0].occurredAt.toISOString(), afterCompletion },
    },
  });
  return 1;
}

export async function pauseEnrollmentsOnFanReply(creatorId: string, fanId: string, messageId: string, repliedAt: Date) {
  const enrollments = await prisma.workflowEnrollment.findMany({
    where: { creatorId, fanId, OR: [{ status: { in: ["ACTIVE", "WAITING"] } }, { status: "PAUSED", nextRunAt: { not: null } }], workflow: { pauseOnFanReply: true } },
    include: { workflow: { select: { name: true, replySilenceMinutes: true } } },
  });
  if (!enrollments.length) return 0;
  let paused = 0;
  await prisma.$transaction(async (transaction) => {
    for (const enrollment of enrollments) {
      const remainingSeconds = enrollment.status === "WAITING" || (enrollment.status === "PAUSED" && enrollment.pausedFromStatus === "WAITING") ? 0 : null;
      const pausedFromStatus = enrollment.status === "PAUSED" ? enrollment.pausedFromStatus : enrollment.status;
      const autoResumeAt = new Date(repliedAt.getTime() + enrollment.workflow.replySilenceMinutes * 60_000);
      const updated = await transaction.workflowEnrollment.updateMany({
        where: { id: enrollment.id, OR: [{ status: { in: ["ACTIVE", "WAITING"] } }, { status: "PAUSED", nextRunAt: { not: null } }] },
        data: { status: "PAUSED", pausedAt: repliedAt, pausedFromStatus, pausedRemainingSeconds: remainingSeconds, pauseReason: `El fan respondió; reanudación automática tras ${enrollment.workflow.replySilenceMinutes} min sin mensajes.`, nextRunAt: autoResumeAt, lockedAt: null, lockOwner: null, lockExpiresAt: null },
      });
      if (!updated.count) continue;
      paused += 1;
      await transaction.automationLog.create({
        data: { creatorId, fanId, enrollmentId: enrollment.id, eventType: "WORKFLOW_PAUSED_BY_REPLY", reasonCode: "FAN_REPLIED", explanation: `${enrollment.workflow.name}: pausado porque el fan respondió; continuará tras ${enrollment.workflow.replySilenceMinutes} min sin nuevos mensajes.`, metadata: { messageId, repliedAt: repliedAt.toISOString(), autoResumeAt: autoResumeAt.toISOString(), remainingSeconds } satisfies Prisma.InputJsonValue },
      });
    }
  });
  return paused;
}

export async function resumeEnrollmentAfterFanSilence(creatorId: string, enrollmentId: string, now: Date) {
  const enrollment = await prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, creatorId, status: "PAUSED", nextRunAt: { lte: now } },
    include: { workflow: { select: { name: true } } },
  });
  if (!enrollment) return false;
  const status: EnrollmentStatus = enrollment.pausedFromStatus === "WAITING" ? "WAITING" : "ACTIVE";
  const nextRunAt = resumedRunAt(enrollment.pausedRemainingSeconds, now);
  const updated = await prisma.workflowEnrollment.updateMany({
    where: { id: enrollment.id, status: "PAUSED", nextRunAt: { lte: now } },
    data: { status, nextRunAt, pausedAt: null, pausedFromStatus: null, pausedRemainingSeconds: null, pauseReason: null },
  });
  if (!updated.count) return false;
  await prisma.automationLog.create({
    data: { creatorId, fanId: enrollment.fanId, enrollmentId, eventType: "WORKFLOW_RESUMED_AFTER_SILENCE", explanation: `${enrollment.workflow.name}: reanudado automáticamente después del período sin respuestas.`, metadata: { resumedAt: now.toISOString(), nextRunAt: nextRunAt.toISOString() } },
  });
  return true;
}

export async function transitionEnrollment(creatorId: string, enrollmentId: string, action: EnrollmentAction, reason?: string) {
  const enrollment = await prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, creatorId }, include: { workflow: { select: { name: true } } },
  });
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");
  const resumedStatus: EnrollmentStatus = enrollment.pausedFromStatus === "WAITING" ? "WAITING" : "ACTIVE";
  const target: EnrollmentStatus = action === "pause" ? "PAUSED" : action === "resume" ? resumedStatus : "CANCELLED";
  assertEnrollmentTransition(enrollment.status, target);
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.workflowEnrollment.update({
      where: { id: enrollment.id },
      data: action === "pause"
        ? { status: target, pausedAt: now, pausedFromStatus: enrollment.status, pausedRemainingSeconds: enrollment.status === "WAITING" ? remainingWaitSeconds(enrollment.nextRunAt, now) : null, pauseReason: reason || "Pausado manualmente.", nextRunAt: null }
        : action === "resume"
          ? { status: target, pausedAt: null, pausedFromStatus: null, pauseReason: null, nextRunAt: resumedRunAt(enrollment.pausedRemainingSeconds, now), pausedRemainingSeconds: null }
          : { status: target, cancelledAt: now, cancellationReason: reason || "Cancelado manualmente.", nextRunAt: null, pausedFromStatus: null, pausedRemainingSeconds: null, lockedAt: null, lockOwner: null, lockExpiresAt: null },
    });
    const eventType = action === "pause" ? "WORKFLOW_PAUSED" : action === "resume" ? "WORKFLOW_RESUMED" : "WORKFLOW_CANCELLED";
    const waitSeconds = action === "pause" && enrollment.status === "WAITING" ? remainingWaitSeconds(enrollment.nextRunAt, now) : action === "resume" ? enrollment.pausedRemainingSeconds : null;
    const explanation = action === "pause" && waitSeconds !== null
      ? `${enrollment.workflow.name}: pausado con ${formatDuration(waitSeconds)} restantes.`
      : action === "resume" && waitSeconds !== null
        ? `${enrollment.workflow.name}: reanudado; continuará en ${formatDuration(waitSeconds)}.`
        : `${enrollment.workflow.name}: ${reason || (action === "pause" ? "pausado manualmente." : action === "resume" ? "reanudado manualmente." : "cancelado manualmente.")}`;
    await transaction.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, eventType, explanation } });
    return updated;
  });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}
