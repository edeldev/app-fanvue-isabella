import type { AutomatedSendLimits } from "@/services/messages/automated-send-budget";

export const mandatorySendCeilings = { perHour: 30, perDay: 200 } as const;

type StoredLimits = Partial<AutomatedSendLimits> & { sendLimitsEnabled?: boolean } | null;

function bounded(value: number | undefined, fallback: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

export function mandatoryAutomatedSendLimits(settings: StoredLimits): AutomatedSendLimits {
  return {
    maxMessagesPerHour: bounded(settings?.maxMessagesPerHour, mandatorySendCeilings.perHour, mandatorySendCeilings.perHour),
    maxMessagesPerDay: bounded(settings?.maxMessagesPerDay, mandatorySendCeilings.perDay, mandatorySendCeilings.perDay),
    // Legacy accounts had limits disabled. Do not silently add a 60-minute
    // per-fan delay to their existing 10/20-minute workflow sequences.
    minMinutesBetweenFanMessages: settings?.sendLimitsEnabled && Number.isInteger(settings.minMinutesBetweenFanMessages)
      ? Math.max(0, settings.minMinutesBetweenFanMessages ?? 0)
      : 0,
  };
}
