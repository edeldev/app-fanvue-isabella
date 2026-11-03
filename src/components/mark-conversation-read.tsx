"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestAutomaticRouteRefresh } from "@/lib/client/route-refresh";

export function MarkConversationRead({ fanUuid }: { fanUuid: string }) {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fanUuid }),
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) requestAutomaticRouteRefresh(router.refresh, 8_000);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [fanUuid, router]);
  return null;
}
