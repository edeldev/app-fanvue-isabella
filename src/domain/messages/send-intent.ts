export function sendIntentRedirectStatus(status: string) {
  if (status === "SENT") return "sent";
  if (status === "PENDING") return "scheduled";
  if (status === "SENDING") return "send_pending";
  if (status === "NEEDS_REVIEW") return "send_review";
  return "send_failed";
}

export function isAmbiguousManualSendFailure(error: unknown) {
  if (!(error instanceof Error)) return true;
  if ("status" in error && typeof error.status === "number") {
    return [408, 425].includes(error.status) || error.status >= 500;
  }
  return !("status" in error);
}
