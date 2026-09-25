"use client";

import Link from "next/link";
import { Check, Clipboard, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import type { NextBestAction } from "@/domain/ai/next-best-action";

export function NextBestActionCard({ fanId, action }: { fanId: string; action: NextBestAction }) {
  const copy = async () => {
    if (!action.suggestedMessage) return;
    await navigator.clipboard.writeText(action.suggestedMessage);
    enqueueSnackbar("Mensaje copiado para revisión", { variant: "success" });
    void fetch("/api/intelligence/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fanId, text: action.suggestedMessage, goal: goalFromAction(action.kind), action: "COPIED" }),
    });
  };
  return <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[.09] to-transparent">
    <div className="border-b border-white/8 p-5"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-300"><Sparkles className="size-4"/>Siguiente mejor acción</p><span className="rounded-full border border-white/8 bg-black/10 px-2 py-1 text-[10px] text-zinc-500">{Math.round(action.confidence * 100)}% confianza</span></div><h2 className="mt-3 text-lg font-semibold text-white">{action.title}</h2><p className="mt-2 text-xs leading-5 text-zinc-400">{action.reason}</p></div>
    <div className="p-5">{action.suggestedMessage ? <div className="rounded-xl border border-white/8 bg-black/15 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Borrador para revisar</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{action.suggestedMessage}</p></div> : <div className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-4"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300"/><p className="text-xs leading-5 text-zinc-400">No se recomienda enviar un mensaje automático en este momento.</p></div>}
      <div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Evidencia utilizada</p><ul className="mt-2 space-y-1.5">{action.evidence.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-zinc-500"><Check className="mt-1 size-3 shrink-0 text-violet-400"/>{item}</li>)}</ul></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{action.suggestedMessage ? <button type="button" onClick={copy} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/5"><Clipboard className="size-4"/>Copiar borrador</button> : null}<Link href={`/messages?fan=${fanId}`} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-400"><MessageCircle className="size-4"/>Abrir chat</Link></div>
    </div>
  </section>;
}

function goalFromAction(kind: NextBestAction["kind"]): "RELATIONSHIP" | "SUBSCRIPTION" | "PPV" {
  if (kind === "SUBSCRIPTION" || kind === "RETENTION") return "SUBSCRIPTION";
  if (kind === "PPV") return "PPV";
  return "RELATIONSHIP";
}

