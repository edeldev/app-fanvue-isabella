import type { WorkflowTrigger } from "@/domain/workflows/triggers";
import { prisma } from "@/lib/prisma";
import { executeEnrollmentUntilBlocked } from "./execute-enrollment";
import { startEnrollment } from "./manage-enrollment";

export async function triggerWorkflowForFan(creatorId: string, fanId: string, triggerEvent: WorkflowTrigger) {
  const workflow = await prisma.workflow.findFirst({
    where: { creatorId, status: "PUBLISHED", isPrimary: true, triggerEvent },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
    select: { id: true, priority: true },
  });
  if (!workflow) return { outcome: "NO_MATCHING_WORKFLOW" } as const;

  const current = await prisma.workflowEnrollment.findFirst({
    where: { creatorId, fanId, isPrimary: true, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
    include: { workflow: { select: { priority: true } } },
  });
  if (current && current.workflow.priority > workflow.priority) return { outcome: "LOWER_PRIORITY" } as const;

  try {
    const enrollment = await startEnrollment(creatorId, fanId, workflow.id);
    await executeEnrollmentUntilBlocked(creatorId, enrollment.id);
    return { outcome: "STARTED", enrollmentId: enrollment.id } as const;
  } catch (error) {
    if (error instanceof Error && error.message === "WORKFLOW_REENTRY_ONCE") return { outcome: "REENTRY_BLOCKED_ONCE" } as const;
    if (error instanceof Error && error.message === "WORKFLOW_REENTRY_COOLDOWN") return { outcome: "REENTRY_COOLDOWN" } as const;
    if (error instanceof Error && error.message === "ENROLLMENT_ALREADY_ACTIVE") return { outcome: "ALREADY_ACTIVE" } as const;
    const retry = await prisma.workflowEnrollment.findFirst({ where: { creatorId, fanId, workflowId: workflow.id, status: { in: ["ACTIVE", "WAITING"] } }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (!retry) return { outcome: "FAILED_TO_START" } as const;
    return { outcome: "SCHEDULED_FOR_RETRY", enrollmentId: retry.id } as const;
  }
}
