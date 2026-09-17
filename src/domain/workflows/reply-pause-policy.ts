type Step = {
  id: string;
  position: number;
  type: string;
  config: unknown;
};

export type ReplyPausePolicy = {
  enabled: boolean;
  silenceMinutes: number | null;
  source: "GLOBAL" | "STEP" | "DISABLED";
  stepId: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function resolveReplyPausePolicy({
  currentStepId,
  steps,
  globalEnabled,
  globalSilenceMinutes,
}: {
  currentStepId: string | null;
  steps: Step[];
  globalEnabled: boolean;
  globalSilenceMinutes: number;
}): ReplyPausePolicy {
  if (!globalEnabled) return { enabled: false, silenceMinutes: null, source: "DISABLED", stepId: null };

  const ordered = [...steps].sort((left, right) => left.position - right.position);
  const byKey = new Map(
    ordered.flatMap((step) => {
      const key = record(step.config).stepKey;
      return typeof key === "string" ? [[key, step] as const] : [];
    }),
  );
  let step = ordered.find((candidate) => candidate.id === currentStepId) ?? null;
  const visited = new Set<string>();

  while (step && !visited.has(step.id)) {
    visited.add(step.id);
    if (step.type === "SEND_MESSAGE" || step.type === "SEND_PPV") {
      const config = record(step.config);
      const mode = config.replyPauseMode;
      if (mode === "DISABLED") return { enabled: false, silenceMinutes: null, source: "DISABLED", stepId: step.id };
      if (mode === "CUSTOM") {
        const minutes = Number(config.replySilenceMinutes);
        if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 43_200) {
          return { enabled: true, silenceMinutes: minutes, source: "STEP", stepId: step.id };
        }
      }
      return { enabled: true, silenceMinutes: globalSilenceMinutes, source: "GLOBAL", stepId: step.id };
    }
    if (step.type === "END") return { enabled: false, silenceMinutes: null, source: "DISABLED", stepId: step.id };
    if (step.type === "CONDITION" || step.type === "CHANGE_WORKFLOW") break;
    const config = record(step.config);
    const explicitNext = typeof config.nextTargetKey === "string" ? byKey.get(config.nextTargetKey) : null;
    const index = ordered.findIndex((candidate) => candidate.id === step?.id);
    step = explicitNext ?? ordered[index + 1] ?? null;
  }

  return { enabled: true, silenceMinutes: globalSilenceMinutes, source: "GLOBAL", stepId: null };
}

