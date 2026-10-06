type ScheduledStep = {
  id: string;
  type: string;
  config: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function scheduleWorkflowStep(step: ScheduledStep | undefined, now: Date) {
  if (!step) return { status: "COMPLETED" as const, currentStepId: null, nextRunAt: null, completedAt: now };
  if (step.type === "WAIT") {
    const minutes = Number(record(step.config).durationMinutes);
    return { status: "WAITING" as const, currentStepId: step.id, nextRunAt: new Date(now.getTime() + minutes * 60_000), completedAt: null };
  }
  // WAIT_FOR_REPLY needs one ACTIVE cycle with no due date so the executor can
  // create its real timeout window. Scheduling it for `now` skips that setup.
  if (step.type === "WAIT_FOR_REPLY") {
    return { status: "ACTIVE" as const, currentStepId: step.id, nextRunAt: null, completedAt: null };
  }
  return { status: "ACTIVE" as const, currentStepId: step.id, nextRunAt: now, completedAt: null };
}
