"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
        if (response.ok) router.refresh();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [fanUuid, router]);
  return null;
}
