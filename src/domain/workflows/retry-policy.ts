import { FanvueAuthenticationError, FanvueError } from "@/lib/fanvue/errors";

export const maximumWorkflowAttempts = 3;

export interface WorkflowRetryDecision {
  retryable: boolean;
  reasonCode: string;
  delaySeconds: number | null;
}

export class ConfirmedSendPersistenceError extends Error {
  constructor(readonly fanvueMessageId: string) {
    super("Fanvue confirmó el envío, pero no se pudo completar el registro local. No vuelvas a enviarlo.");
    this.name = "ConfirmedSendPersistenceError";
  }
}

export function workflowRetryDecision(error: unknown, attempt: number, options: { maximumAttempts?: number; minimumDelaySeconds?: number } = {}): WorkflowRetryDecision {
  const maximumAttempts = options.maximumAttempts ?? maximumWorkflowAttempts;
  const minimumDelaySeconds = options.minimumDelaySeconds ?? 60;
  if (error instanceof Error && error.message === "MEDIA_ORIGIN_REQUIRED") {
    return { retryable: false, reasonCode: "MEDIA_ORIGIN_REQUIRED", delaySeconds: null };
  }
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
  if (attempt >= maximumAttempts) {
    return { retryable: false, reasonCode: "MAXIMUM_RETRIES_REACHED", delaySeconds: null };
  }
  const fallbackSeconds = attempt === 1 ? minimumDelaySeconds : minimumDelaySeconds * 5;
  const retryAfter = error instanceof FanvueError && Number.isFinite(error.retryAfterSeconds) ? Math.max(1, error.retryAfterSeconds ?? 0) : 0;
  return { retryable: true, reasonCode: error instanceof FanvueError && error.status === 429 ? "FANVUE_RATE_LIMIT" : "FANVUE_TEMPORARY_ERROR", delaySeconds: Math.min(Math.max(fallbackSeconds, retryAfter), 86_400) };
}

// A send can have reached Fanvue even when the response was lost. Only a 429
// explicitly confirms that the request was rejected and is safe to retry.
export function workflowSendRetryDecision(error: unknown, attempt: number, options: { maximumAttempts?: number; minimumDelaySeconds?: number } = {}): WorkflowRetryDecision {
  if (error instanceof ConfirmedSendPersistenceError) {
    return { retryable: false, reasonCode: "FANVUE_SEND_CONFIRMED_PERSISTENCE_FAILED", delaySeconds: null };
  }
  if (error instanceof FanvueError && error.status === 429) {
    return workflowRetryDecision(error, attempt, options);
  }
  if (error instanceof TypeError || error instanceof SyntaxError || (error instanceof FanvueError && (error.code === "FANVUE_INVALID_RESPONSE" || [408, 425].includes(error.status) || error.status >= 500))) {
    return { retryable: false, reasonCode: "FANVUE_AMBIGUOUS_SEND_RESPONSE", delaySeconds: null };
  }
  return workflowRetryDecision(error, attempt, options);
}
