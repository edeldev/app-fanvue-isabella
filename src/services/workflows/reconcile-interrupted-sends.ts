import { isInterruptedWorkflowSend, interruptedSendGraceMs } from "@/domain/workflows/interrupted-send";
import { prisma } from "@/lib/prisma";

class ReconciliationRace extends Error {}

export async function reconcileInterruptedWorkflowSends(now = new Date(), creatorId?: string) {
  let reviewed = 0;
  let cursor: string | undefined;
  for (let page = 0; page < 20 && reviewed < 50; page += 1) {
  const candidates = await prisma.automationExecution.findMany({
    where: {
      ...(creatorId ? { creatorId } : {}),
      status: "RUNNING",
      startedAt: { lt: new Date(now.getTime() - interruptedSendGraceMs) },
      step: { type: { in: ["SEND_MESSAGE", "SEND_PPV"] } },
      enrollment: { status: { in: ["ACTIVE", "WAITING"] }, OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }] },
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    take: 50,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, creatorId: true, fanId: true, enrollmentId: true, stepId: true, status: true, startedAt: true,
      step: { select: { type: true, name: true } },
      enrollment: { select: { currentStepId: true, lockExpiresAt: true } },
    },
  });
  if (!candidates.length) break;
  cursor = candidates[candidates.length - 1].id;

  for (const candidate of candidates) {
    if (candidate.enrollment.currentStepId !== candidate.stepId || !isInterruptedWorkflowSend({
      executionStatus: candidate.status,
      stepType: candidate.step.type,
      startedAt: candidate.startedAt,
      lockExpiresAt: candidate.enrollment.lockExpiresAt,
      now,
    })) continue;

    try {
      await prisma.$transaction(async (transaction) => {
        const enrollment = await transaction.workflowEnrollment.updateMany({
          where: {
            id: candidate.enrollmentId,
            currentStepId: candidate.stepId,
            status: { in: ["ACTIVE", "WAITING"] },
            OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }],
          },
          data: {
            status: "FAILED", nextRunAt: null,
            lastResult: { reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE", stepId: candidate.stepId, interruptedAt: now.toISOString() },
            lockedAt: null, lockOwner: null, lockExpiresAt: null,
          },
        });
        if (enrollment.count !== 1) throw new ReconciliationRace();
        const execution = await transaction.automationExecution.updateMany({
          where: { id: candidate.id, status: "RUNNING", startedAt: candidate.startedAt },
          data: {
            status: "FAILED", decision: "CANCEL", reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE",
            reason: "La ejecución se interrumpió durante un envío. Comprueba en Fanvue si el mensaje llegó antes de actuar.",
            finishedAt: now, nextRetryAt: null,
          },
        });
        if (execution.count !== 1) throw new ReconciliationRace();
        await transaction.automationLog.create({
          data: {
            creatorId: candidate.creatorId, fanId: candidate.fanId, enrollmentId: candidate.enrollmentId,
            executionId: candidate.id, eventType: "WORKFLOW_STEP_FAILED", level: "ERROR",
            reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE",
            explanation: `${candidate.step.name}: el servidor se interrumpió durante el envío; se detuvo el workflow para evitar un mensaje duplicado. Comprueba el chat en Fanvue.`,
            metadata: { stepId: candidate.stepId, startedAt: candidate.startedAt?.toISOString() },
          },
        });
      });
      reviewed += 1;
    } catch (error) {
      if (!(error instanceof ReconciliationRace)) throw error;
    }
  }
  if (candidates.length < 50) break;
  }
  return reviewed;
}
