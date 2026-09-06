export function remainingWaitSeconds(nextRunAt: Date | null, now: Date) {
  if (!nextRunAt) return null;
  return Math.max(0, Math.ceil((nextRunAt.getTime() - now.getTime()) / 1000));
}

export function resumedRunAt(remainingSeconds: number | null, now: Date) {
  return remainingSeconds === null
    ? now
    : new Date(now.getTime() + Math.max(0, remainingSeconds) * 1000);
}
