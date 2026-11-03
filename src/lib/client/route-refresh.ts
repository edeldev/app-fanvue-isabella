import { startTransition } from "react";

let nextAutomaticRefreshAt = 0;

export function requestAutomaticRouteRefresh(
  refresh: () => void,
  minimumIntervalMs = 5_000,
) {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible" || !navigator.onLine) return false;
  if (document.querySelector('[role="dialog"]')) return false;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || active instanceof HTMLSelectElement) return false;

  const now = Date.now();
  if (now < nextAutomaticRefreshAt) return false;
  nextAutomaticRefreshAt = now + minimumIntervalMs;
  startTransition(() => refresh());
  return true;
}
