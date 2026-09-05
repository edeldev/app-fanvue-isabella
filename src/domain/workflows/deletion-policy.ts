export type WorkflowLifecycleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface WorkflowUsage {
  enrollments: number;
  executions: number;
}

export function canDeleteWorkflow(status: WorkflowLifecycleStatus, usage: WorkflowUsage): boolean {
  if (status === "DRAFT") return true;
  if (status === "ARCHIVED") return false;
  return usage.enrollments === 0 && usage.executions === 0;
}
