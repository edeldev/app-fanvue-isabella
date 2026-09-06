import { prisma } from "@/lib/prisma";
import { executeEnrollmentUntilBlocked } from "@/services/workflows/execute-enrollment";
import type { SchedulerRunResult } from "./scheduler";

export async function runDueWorkflows(creatorId: string, now = new Date()): Promise<SchedulerRunResult> {
  const due = await prisma.workflowEnrollment.findMany({
    where: {
      creatorId,
      status: { in: ["ACTIVE", "WAITING"] },
      nextRunAt: { lte: now },
      OR: [
        { status: "WAITING" },
        { lastRunAt: { not: null } },
        { executions: { some: {} } },
      ],
    },
    orderBy: { nextRunAt: "asc" },
    take: 20,
    select: { id: true },
  });
  const result: SchedulerRunResult = { claimed: due.length, completed: 0, deferred: 0, failed: 0 };
  for (const enrollment of due) {
    try {
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
