"use client";

import { Bell, Check, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface WorkflowAlertView {
  id: string;
  explanation: string;
  reasonCode: string | null;
  occurredAt: string;
  reviewed: boolean;
  fanName: string | null;
  workflowName: string | null;
}

export function WorkflowAlertsMenu({ alerts, unreadCount }: { alerts: WorkflowAlertView[]; unreadCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function review(scope: "all" | "one", alertId?: string) {
    setBusy(scope === "all" ? "all" : alertId ?? null);
    try {
      const response = await fetch("/api/workflow-alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scope === "all" ? { scope } : { scope, alertId }) });
      if (response.ok) router.refresh();
    } finally { setBusy(null); }
  }

  return <details className="group relative"><summary aria-label={`${unreadCount} alertas de workflows sin revisar`} className="relative grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-white/8 text-zinc-400 transition hover:border-white/15 hover:text-white [&::-webkit-details-marker]:hidden"><Bell className="size-4" />{unreadCount > 0 ? <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-5 text-white ring-2 ring-[#101218]">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</summary><div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#181a21] shadow-2xl shadow-black/50"><div className="flex items-center justify-between gap-3 border-b border-white/8 p-4"><div><p className="text-sm font-semibold text-white">Alertas de workflows</p><p className="mt-0.5 text-[10px] text-zinc-600">{unreadCount ? `${unreadCount} pendientes de revisar` : "Todo revisado"}</p></div>{unreadCount ? <button type="button" disabled={busy !== null} onClick={() => review("all")} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-violet-300 hover:bg-violet-400/10 disabled:opacity-40">{busy === "all" ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}Revisar todas</button> : null}</div><div className="max-h-96 overflow-y-auto">{alerts.map((alert) => <div key={alert.id} className={`border-b border-white/6 p-4 last:border-0 ${alert.reviewed ? "opacity-55" : "bg-red-400/[.025]"}`}><div className="flex items-start gap-3"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-red-400/10 text-red-300"><TriangleAlert className="size-3.5" /></span><div className="min-w-0 flex-1"><p className="text-xs leading-5 text-zinc-200">{alert.explanation}</p><p className="mt-1 truncate text-[10px] text-zinc-600">{alert.fanName ?? "Fan desconocido"}{alert.workflowName ? ` · ${alert.workflowName}` : ""}</p><div className="mt-2 flex items-center justify-between gap-2"><time className="text-[10px] text-zinc-700" dateTime={alert.occurredAt}>{new Date(alert.occurredAt).toLocaleString("es-MX")}</time>{!alert.reviewed ? <button type="button" disabled={busy !== null} onClick={() => review("one", alert.id)} className="text-[10px] font-medium text-zinc-500 hover:text-emerald-300 disabled:opacity-40">{busy === alert.id ? "Revisando…" : "Marcar revisada"}</button> : <span className="text-[10px] text-emerald-400/60">Revisada</span>}</div>{alert.reasonCode ? <p className="mt-1 font-mono text-[9px] text-zinc-700">{alert.reasonCode}</p> : null}</div></div></div>)}{!alerts.length ? <div className="p-8 text-center"><Check className="mx-auto size-6 text-emerald-400/60" /><p className="mt-2 text-xs text-zinc-500">No hay ejecuciones fallidas.</p></div> : null}</div><Link href="/workflows#historial-workflows" className="flex items-center justify-center gap-2 border-t border-white/8 px-4 py-3 text-xs font-medium text-violet-300 hover:bg-white/[.025]">Abrir historial de workflows<ExternalLink className="size-3" /></Link></div></details>;
}
