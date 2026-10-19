type Step = { id: string; position: number; config: unknown };

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function nextWorkflowStep<T extends Step>(steps: T[], step: Pick<Step, "position" | "config">): T | undefined {
  const targetKey = record(step.config).nextTargetKey;
  if (typeof targetKey === "string") return steps.find((candidate) => record(candidate.config).stepKey === targetKey);
  return steps.find((candidate) => candidate.position === step.position + 1);
}
