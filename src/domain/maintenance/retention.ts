export const operationalLogRetentionDays = 90;
export const webhookPayloadRetentionDays = 90;
export const maintenanceIntervalHours = 24;

export function retentionCutoff(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
}

export function maintenanceIsDue(lastSucceededAt: Date | null, now: Date) {
  return !lastSucceededAt || now.getTime() - lastSucceededAt.getTime() >= maintenanceIntervalHours * 60 * 60 * 1_000;
}
