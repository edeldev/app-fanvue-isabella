"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SyncFanvueButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    try {
      const response = await fetch("/api/sync/fanvue", { method: "POST" });
      const destination = new URL(response.url);
      router.replace(`${destination.pathname}${destination.search}`);
      router.refresh();
    } catch {
      router.replace("/?sync=failed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex min-w-49 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
        <span aria-live="polite">
          {pending ? "Sincronizando..." : "Sincronizar Fanvue"}
        </span>
      </button>
    </form>
  );
}
