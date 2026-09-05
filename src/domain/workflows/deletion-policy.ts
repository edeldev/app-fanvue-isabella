export type WorkflowLifecycleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface WorkflowUsage {
  activeEnrollments: number;
}

export function canDeleteWorkflow(status: WorkflowLifecycleStatus, usage: WorkflowUsage): boolean {
  if (status === "DRAFT") return true;
  if (status === "ARCHIVED") return false;
  return usage.activeEnrollments === 0;
}
