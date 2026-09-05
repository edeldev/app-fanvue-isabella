export const enrollmentStatuses = [
  "ACTIVE", "WAITING", "PAUSED", "COMPLETED", "CANCELLED", "FAILED",
] as const;
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];

export const executionStatuses = [
  "PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED", "RETRYING",
] as const;
export type ExecutionStatus = (typeof executionStatuses)[number];

export const validationDecisions = [
  "SEND", "WAIT", "SKIP", "CANCEL", "CHANGE_WORKFLOW", "RETRY",
] as const;
export type ValidationDecision = (typeof validationDecisions)[number];

export interface ValidationResult {
  decision: ValidationDecision;
  reasonCode: string;
  explanation: string;
  evidence?: Readonly<Record<string, unknown>>;
  nextEvaluationAt?: Date;
  targetWorkflowId?: string;
}

