"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function IntelligenceLiveRefresh({ intervalMs = 8_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const revision = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let running = false;
    async function poll() {
      if (stopped || running || shouldPauseRefresh()) return;
      running = true;
      try {
        const response = await fetch("/api/intelligence/recommendations", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const body = await response.json() as { revision: string };
        if (revision.current === null) {
          revision.current = body.revision;
          return;
        }
        if (body.revision !== revision.current) {
          revision.current = body.revision;
          router.refresh();
        }
      } catch {
        // El siguiente ciclo vuelve a intentarlo sin interrumpir al usuario.
      } finally {
        running = false;
      }
    }
    const onFocus = () => void poll();
    const timer = window.setInterval(() => void poll(), intervalMs);
    window.addEventListener("focus", onFocus);
    void poll();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, router]);

  return null;
}

function shouldPauseRefresh() {
  if (document.visibilityState !== "visible" || document.querySelector('[role="dialog"]')) return true;
  const active = document.activeElement;
  return active instanceof HTMLInputElement
    || active instanceof HTMLTextAreaElement
    || active instanceof HTMLSelectElement;
}
