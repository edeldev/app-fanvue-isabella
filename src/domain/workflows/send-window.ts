export interface SendWindow {
  enabled: boolean;
  timeZone: string;
  startMinute: number;
  endMinute: number;
  days: number[];
}

const weekdayNumbers: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: weekdayNumbers[value.weekday] ?? 0, minute: Number(value.hour) * 60 + Number(value.minute) };
}

export function isInsideSendWindow(date: Date, window: SendWindow) {
  if (!window.enabled) return true;
  const local = localParts(date, window.timeZone);
  if (window.startMinute === window.endMinute) return window.days.includes(local.day);
  if (window.startMinute < window.endMinute) {
    return window.days.includes(local.day) && local.minute >= window.startMinute && local.minute < window.endMinute;
  }
  if (local.minute >= window.startMinute) return window.days.includes(local.day);
  const previousDay = (local.day + 6) % 7;
  return local.minute < window.endMinute && window.days.includes(previousDay);
}

export function nextSendWindowOpening(date: Date, window: SendWindow) {
  if (isInsideSendWindow(date, window)) return date;
  const candidate = new Date(date);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let minutes = 0; minutes <= 8 * 24 * 60; minutes += 1) {
    if (isInsideSendWindow(candidate, window)) return candidate;
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("WORKFLOW_SEND_WINDOW_UNREACHABLE");
}
