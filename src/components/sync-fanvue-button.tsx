"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncFanvueButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function synchronize() {
    if (pending) return;

    setPending(true);
    try {
      const response = await fetch("/api/sync/fanvue", { method: "POST" });
      const body = await response.json().catch(() => null) as { status?: string; retryAfter?: number } | null;
      const status = body?.status ?? (response.ok ? "completed" : "failed");
      const query = new URLSearchParams({ sync: status });
      if (body?.retryAfter) query.set("retryAfter", String(body.retryAfter));
      router.replace(`/dashboard?${query}`);
      router.refresh();
    } catch {
      router.replace("/dashboard?sync=failed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="md:text-right">
      <button
        type="button"
        onClick={() => void synchronize()}
        disabled={pending}
        aria-busy={pending}
        className="flex min-w-49 items-center justify-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_26px_rgba(139,92,246,.16)] transition hover:bg-violet-400 hover:shadow-[0_0_34px_rgba(168,85,247,.25)] disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
        <span aria-live="polite">
          {pending ? "Actualizando datos…" : "Actualizar datos de Fanvue"}
        </span>
      </button>
      <p className="mt-2 max-w-60 text-[10px] leading-4 text-zinc-600 md:ml-auto">
        Refresca fans, mensajes, suscripciones e ingresos ahora.
      </p>
    </div>
  );
}
