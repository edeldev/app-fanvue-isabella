"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function WorkflowAutoRunner({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let running = false;
    async function run() {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch("/api/workflows/run-due", { method: "POST" });
        if (!response.ok) return;
        const result = await response.json() as { claimed?: number };
        if (result.claimed) router.refresh();
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
