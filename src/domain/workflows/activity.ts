export const workflowActivityEventTypes = [
  "WORKFLOW_STARTED",
  "WORKFLOW_CHANGED",
  "WORKFLOW_PAUSED",
  "WORKFLOW_RESUMED",
  "WORKFLOW_CANCELLED",
] as const;

export function activityRetentionCutoff(now: Date, retentionDays = 90) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
