import { prisma } from "@/lib/prisma";
import { executeEnrollmentUntilBlocked } from "@/services/workflows/execute-enrollment";
import type { SchedulerRunResult } from "./scheduler";
import { resumeEnrollmentAfterFanSilence } from "@/services/workflows/manage-enrollment";

export async function runDueWorkflows(creatorId: string, now = new Date()): Promise<SchedulerRunResult> {
  const due = await prisma.workflowEnrollment.findMany({
    where: {
      creatorId,
      status: { in: ["ACTIVE", "WAITING", "PAUSED"] },
      nextRunAt: { lte: now },
      OR: [
        { status: { in: ["WAITING", "PAUSED"] } },
        { lastRunAt: { not: null } },
        { executions: { some: {} } },
      ],
    },
    orderBy: { nextRunAt: "asc" },
    take: 20,
    select: { id: true, status: true },
  });
  const result: SchedulerRunResult = { claimed: due.length, completed: 0, deferred: 0, failed: 0 };
  for (const enrollment of due) {
    try {
      if (enrollment.status === "PAUSED") {
        const resumed = await resumeEnrollmentAfterFanSilence(creatorId, enrollment.id, now);
        if (!resumed) {
          result.claimed -= 1;
          continue;
        }
        result.deferred += 1;
        continue;
      }
      const execution = await executeEnrollmentUntilBlocked(creatorId, enrollment.id);
      if (execution.completed) result.completed += 1;
      else result.deferred += 1;
    } catch (error) {
      if (error instanceof Error && error.message === "ENROLLMENT_BUSY") result.claimed -= 1;
      else result.failed += 1;
    }
  }
  return result;
}

export async function runDueWorkflowsForAllCreators(now = new Date()) {
  const dueCreators = await prisma.workflowEnrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "WAITING", "PAUSED"] },
      nextRunAt: { lte: now },
      OR: [
        { status: { in: ["WAITING", "PAUSED"] } },
        { lastRunAt: { not: null } },
        { executions: { some: {} } },
      ],
    },
    distinct: ["creatorId"],
    take: 50,
    select: { creatorId: true },
  });
  const total: SchedulerRunResult & { creators: number } = { creators: dueCreators.length, claimed: 0, completed: 0, deferred: 0, failed: 0 };
  for (const { creatorId } of dueCreators) {
    const result = await runDueWorkflows(creatorId, now);
    total.claimed += result.claimed;
    total.completed += result.completed;
    total.deferred += result.deferred;
    total.failed += result.failed;
  }
  return total;
}
