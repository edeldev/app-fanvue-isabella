export const workflowActivityEventTypes = [
  "WORKFLOW_ASSIGNED",
  "WORKFLOW_STARTED",
  "WORKFLOW_CHANGED",
  "WORKFLOW_PAUSED",
  "WORKFLOW_RESUMED",
  "WORKFLOW_CANCELLED",
  "WORKFLOW_MESSAGE_SENT",
  "WORKFLOW_WAIT_COMPLETED",
  "WORKFLOW_WAIT_STARTED",
  "WORKFLOW_COMPLETED",
  "WORKFLOW_STEP_FAILED",
] as const;

export function activityRetentionCutoff(now: Date, retentionDays = 90) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
