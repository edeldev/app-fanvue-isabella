"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestAutomaticRouteRefresh } from "@/lib/client/route-refresh";

export function WorkflowAutoRunner({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let running = false;
    let unauthorized = false;
    async function run() {
      if (running || unauthorized || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch("/api/workflows/run-due", { method: "POST" });
        if (response.status === 401) {
          unauthorized = true;
          return;
        }
        if (!response.ok) return;
        const result = await response.json() as { claimed?: number };
        if (result.claimed) requestAutomaticRouteRefresh(router.refresh, 8_000);
      } catch {
        // A temporary network failure should not interrupt the page.
      } finally {
        running = false;
      }
    }
    const timer = window.setInterval(run, intervalMs);
    void run();
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);
  return null;
}
