"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestAutomaticRouteRefresh } from "@/lib/client/route-refresh";

export function LiveRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      requestAutomaticRouteRefresh(router.refresh, 8_000);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return null;
}
