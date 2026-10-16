export function silenceWaitDeadline(activityAt: Date, silenceMinutes: number) {
  if (!Number.isInteger(silenceMinutes) || silenceMinutes < 1 || silenceMinutes > 43_200) {
    throw new Error("WORKFLOW_SILENCE_MINUTES_INVALID");
  }
  return new Date(activityAt.getTime() + silenceMinutes * 60_000);
}
