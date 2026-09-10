import type { Prisma } from "@prisma/client";
import { matchesWorkflowGoal, workflowGoalLabels, type GoalEvent, type WorkflowGoalType } from "@/domain/workflows/conversion-goal";
import { prisma } from "@/lib/prisma";

export async function completeMatchingWorkflowGoals(creatorId: string, fanId: string, event: GoalEvent, metadata: Record<string, unknown> = {}) {
  const enrollments = await prisma.workflowEnrollment.findMany({
    where: { creatorId, fanId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] }, workflow: { goalType: { not: "NONE" } } },
    include: { workflow: { select: { name: true, goalType: true, goalAmountMinor: true } } },
  });
  let completed = 0;
  for (const enrollment of enrollments) {
    const goalType = enrollment.workflow.goalType as WorkflowGoalType;
    if (!matchesWorkflowGoal(goalType, enrollment.workflow.goalAmountMinor, event)) continue;
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.workflowEnrollment.updateMany({
        where: { id: enrollment.id, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
        data: { status: "COMPLETED", currentStepId: null, nextRunAt: null, completedAt: now, pausedAt: null, pausedFromStatus: null, pausedRemainingSeconds: null, pauseReason: null, lockedAt: null, lockOwner: null, lockExpiresAt: null, lastResult: { reasonCode: "CONVERSION_GOAL_REACHED", goalType, ...metadata } as Prisma.InputJsonValue },
      });
      if (!updated.count) return;
      completed += 1;
      const amount = typeof metadata.amountMinor === "number" ? ` por $${(metadata.amountMinor / 100).toFixed(2)}` : "";
      await transaction.automationLog.create({
        data: { creatorId, fanId, enrollmentId: enrollment.id, eventType: "WORKFLOW_GOAL_COMPLETED", reasonCode: "CONVERSION_GOAL_REACHED", explanation: `${enrollment.workflow.name}: objetivo cumplido (${workflowGoalLabels[goalType]})${amount}; los mensajes restantes fueron detenidos.`, metadata: { goalType, ...metadata } as Prisma.InputJsonValue },
      });
    });
  }
  return completed;
}
