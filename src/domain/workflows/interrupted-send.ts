export const interruptedSendGraceMs = 5 * 60_000;

export function isInterruptedWorkflowSend(input: {
  executionStatus: string;
  stepType: string;
  startedAt: Date | null;
  lockExpiresAt: Date | null;
  now: Date;
}) {
  return input.executionStatus === "RUNNING"
    && (input.stepType === "SEND_MESSAGE" || input.stepType === "SEND_PPV")
    && input.startedAt !== null
    && input.startedAt.getTime() < input.now.getTime() - interruptedSendGraceMs
    && (input.lockExpiresAt === null || input.lockExpiresAt.getTime() < input.now.getTime());
}
