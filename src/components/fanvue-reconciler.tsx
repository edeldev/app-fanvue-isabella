"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function FanvueReconciler({ intervalMs = 5 * 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let running = false;
    async function reconcile() {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch("/api/sync/fanvue/reconcile", { method: "POST" });
        if (!response.ok) return;
        const result = await response.json() as { reconciled?: boolean };
        if (result.reconciled) router.refresh();
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
