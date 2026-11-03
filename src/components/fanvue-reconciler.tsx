"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestAutomaticRouteRefresh } from "@/lib/client/route-refresh";

export function FanvueReconciler({ intervalMs = 15 * 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let running = false;
    let unauthorized = false;
    async function reconcile() {
      if (running || unauthorized || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch("/api/sync/fanvue/reconcile", { method: "POST" });
        if (response.status === 401) {
          unauthorized = true;
          return;
        }
        if (!response.ok) return;
        const result = await response.json() as { reconciled?: boolean };
        if (result.reconciled) requestAutomaticRouteRefresh(router.refresh, 8_000);
      } catch {
        // A temporary network failure should not interrupt the page.
      } finally {
        running = false;
      }
    }
    const timer = window.setInterval(reconcile, intervalMs);
    void reconcile();
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);
  return null;
}
