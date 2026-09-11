"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function FanPresenceReconciler({ intervalMs = 2 * 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let running = false;
    let stopped = false;
    async function reconcile() {
      if (running || stopped || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch("/api/sync/fanvue/presence", { method: "POST" });
        if (response.ok && !stopped) router.refresh();
      } catch {
        // Webhooks continue working if this fallback request temporarily fails.
      } finally {
        running = false;
      }
    }
    const timer = window.setInterval(reconcile, intervalMs);
    void reconcile();
    return () => { stopped = true; window.clearInterval(timer); };
  }, [intervalMs, router]);

  return null;
}
