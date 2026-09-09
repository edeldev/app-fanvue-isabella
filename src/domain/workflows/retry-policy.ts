import { FanvueAuthenticationError, FanvueError } from "@/lib/fanvue/errors";

export const maximumWorkflowAttempts = 3;

export interface WorkflowRetryDecision {
  retryable: boolean;
  reasonCode: string;
  delaySeconds: number | null;
}

export function workflowRetryDecision(error: unknown, attempt: number): WorkflowRetryDecision {
  if (error instanceof FanvueAuthenticationError || (error instanceof FanvueError && [401, 403].includes(error.status))) {
    return { retryable: false, reasonCode: "FANVUE_AUTHORIZATION_REQUIRED", delaySeconds: null };
  }
  if (error instanceof FanvueError && error.code === "FANVUE_INVALID_RESPONSE") {
    return { retryable: false, reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE", delaySeconds: null };
  }
  const retryableFanvueStatus = error instanceof FanvueError && ([408, 425, 429].includes(error.status) || error.status >= 500);
  const retryableNetworkError = error instanceof TypeError;
  if (!retryableFanvueStatus && !retryableNetworkError) {
    return { retryable: false, reasonCode: "WORKFLOW_PERMANENT_STEP_ERROR", delaySeconds: null };
  }
  if (attempt >= maximumWorkflowAttempts) {
    return { retryable: false, reasonCode: "MAXIMUM_RETRIES_REACHED", delaySeconds: null };
  }
  const fallbackSeconds = attempt === 1 ? 60 : 300;
  const retryAfter = error instanceof FanvueError && Number.isFinite(error.retryAfterSeconds) ? Math.max(1, error.retryAfterSeconds ?? 0) : 0;
  return { retryable: true, reasonCode: error instanceof FanvueError && error.status === 429 ? "FANVUE_RATE_LIMIT" : "FANVUE_TEMPORARY_ERROR", delaySeconds: Math.min(Math.max(fallbackSeconds, retryAfter), 86_400) };
}
