import { prisma } from "@/lib/prisma";
import { maximumWorkflowAttempts } from "@/domain/workflows/retry-policy";
import { sendRecoveryBlock } from "@/domain/workflows/failure-recovery";
import { nextWorkflowStep } from "@/domain/workflows/next-step";
import { scheduleWorkflowStep } from "@/domain/workflows/step-schedule";

export type FailureRecoveryAction = "retry_now" | "resume_from_failed" | "continue_after_verified_send" | "cancel";

export async function recoverFailedEnrollment(creatorId: string, enrollmentId: string, action: FailureRecoveryAction, verifiedInFanvue = false) {
  const enrollment = await prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, creatorId },
    include: {
      workflow: { select: { name: true, steps: { orderBy: { position: "asc" }, select: { id: true, position: true, type: true, config: true } } } },
      currentStep: { select: { id: true, name: true, type: true, position: true, config: true } },
      fan: { select: { displayName: true, username: true } },
    },
  });
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");
  if (enrollment.status !== "FAILED") throw new Error("ENROLLMENT_NOT_FAILED");

  if (action === "cancel") {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.workflowEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Cancelado definitivamente después de un fallo.", nextRunAt: null, lockedAt: null, lockOwner: null, lockExpiresAt: null },
      });
      await transaction.automationLog.create({
        data: { creatorId, fanId: enrollment.fanId, enrollmentId, eventType: "WORKFLOW_FAILURE_CANCELLED", explanation: `${enrollment.workflow.name}: fallo cancelado definitivamente por el administrador.` },
      });
      return updated;
    });
  }

  if (!enrollment.currentStep) throw new Error("ENROLLMENT_STEP_NOT_FOUND");
  const execution = await prisma.automationExecution.findUnique({
    where: { idempotencyKey: `${enrollment.id}:${enrollment.currentStep.id}` },
  });
  if (!execution || execution.status !== "FAILED") throw new Error("FAILED_EXECUTION_NOT_FOUND");

  if (action === "continue_after_verified_send") {
    if (!verifiedInFanvue) throw new Error("FANVUE_SEND_VERIFICATION_REQUIRED");
    if (enrollment.currentStep.type !== "SEND_MESSAGE" && enrollment.currentStep.type !== "SEND_PPV") throw new Error("RECOVERY_ACTION_NOT_ALLOWED");
    if (!["FANVUE_AMBIGUOUS_SEND_RESPONSE", "FANVUE_SEND_CONFIRMED_PERSISTENCE_FAILED"].includes(execution.reasonCode ?? "")) throw new Error("RECOVERY_ACTION_NOT_ALLOWED");
    const now = new Date();
    const next = nextWorkflowStep(enrollment.workflow.steps, enrollment.currentStep);
    const schedule = scheduleWorkflowStep(next, now);
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.workflowEnrollment.updateMany({
        where: { id: enrollment.id, creatorId, status: "FAILED", currentStepId: enrollment.currentStep!.id },
        data: { ...schedule, lastRunAt: now, lastResult: { reasonCode: "MANUAL_SEND_VERIFIED", stepId: enrollment.currentStep!.id, nextStepId: next?.id ?? null }, lockedAt: null, lockOwner: null, lockExpiresAt: null },
      });
      if (updated.count !== 1) throw new Error("ENROLLMENT_NOT_FAILED");
      await transaction.automationExecution.update({
        where: { id: execution.id },
        data: { status: "SKIPPED", decision: "SKIP", reasonCode: "MANUAL_SEND_VERIFIED", reason: "El administrador verificó en Fanvue el mensaje y continuó sin reenviar.", finishedAt: now },
      });
      await transaction.automationLog.create({
        data: { creatorId, fanId: enrollment.fanId, enrollmentId, executionId: execution.id, eventType: "WORKFLOW_SEND_VERIFIED_MANUALLY", reasonCode: "MANUAL_SEND_VERIFIED", explanation: `${enrollment.workflow.name}: el administrador confirmó el envío de ${enrollment.currentStep!.name} en Fanvue y avanzó sin reenviar.`, metadata: { stepId: enrollment.currentStep!.id, nextStepId: next?.id ?? null, previousReasonCode: execution.reasonCode } },
      });
      return { action, enrollmentId, nextStepId: next?.id ?? null };
    });
  }

  if (enrollment.currentStep.type === "SEND_MESSAGE" || enrollment.currentStep.type === "SEND_PPV") {
    if (execution.reasonCode === "FANVUE_AMBIGUOUS_SEND_RESPONSE") throw new Error("RECOVERY_SEND_STATUS_UNCERTAIN");
    if (execution.reasonCode === "FANVUE_SEND_CONFIRMED_PERSISTENCE_FAILED") throw new Error("RECOVERY_MESSAGE_ALREADY_SENT");
    const reservation = await prisma.workflowSendReservation.findUnique({
      where: { enrollmentId_stepId: { enrollmentId, stepId: enrollment.currentStep.id } },
    });
    const hasFanvueMessageId = Boolean(execution.evidence && typeof execution.evidence === "object" && !Array.isArray(execution.evidence) && "fanvueMessageId" in execution.evidence);
    const blocked = sendRecoveryBlock({ reservation, hasFanvueMessageId });
    if (blocked) throw new Error(blocked);
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: "RETRYING", attempt: action === "retry_now" ? maximumWorkflowAttempts - 1 : 0, decision: "RETRY", reasonCode: "MANUAL_RECOVERY", reason: action === "retry_now" ? "Reintento manual inmediato." : "Reanudado manualmente desde el paso fallido.", nextRetryAt: now, finishedAt: null },
    }),
    prisma.workflowEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "WAITING", nextRunAt: now, lastResult: { reasonCode: "MANUAL_RECOVERY", action, stepId: enrollment.currentStep.id }, lockedAt: null, lockOwner: null, lockExpiresAt: null },
    }),
    prisma.automationLog.create({
      data: { creatorId, fanId: enrollment.fanId, enrollmentId, executionId: execution.id, eventType: action === "retry_now" ? "WORKFLOW_MANUAL_RETRY" : "WORKFLOW_RESUMED_FROM_FAILURE", explanation: action === "retry_now" ? `${enrollment.workflow.name}: reintento manual inmediato solicitado desde ${enrollment.currentStep.name}.` : `${enrollment.workflow.name}: reanudado desde el paso fallido ${enrollment.currentStep.name}; el cron continuará la ejecución.`, metadata: { action, stepId: enrollment.currentStep.id, previousAttempt: execution.attempt } },
    }),
  ]);
  return { action, enrollmentId };
}
