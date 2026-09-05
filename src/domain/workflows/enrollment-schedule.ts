interface InitialStep {
  type: string;
  config: unknown;
}

export function initialEnrollmentSchedule(step: InitialStep, now: Date) {
  if (step.type !== "WAIT") {
    return { status: "ACTIVE" as const, nextRunAt: now };
  }

  const config = isRecord(step.config) ? step.config : {};
  const durationMinutes = Number(config.durationMinutes);
  const safeDuration = Number.isInteger(durationMinutes) && durationMinutes > 0
    ? durationMinutes
    : 1;

  return {
    status: "WAITING" as const,
    nextRunAt: new Date(now.getTime() + safeDuration * 60_000),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
