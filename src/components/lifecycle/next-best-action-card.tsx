import Link from "next/link";
import { ArrowRight, Check, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { NextBestAction } from "@/domain/ai/next-best-action";

export function NextBestActionCard({ fanId, action }: { fanId: string; action: NextBestAction }) {
  return <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[.09] to-transparent">
    <div className="p-5"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-violet-300"><Sparkles className="size-4"/>Plan recomendado</p><span className="rounded-full border border-white/8 bg-black/10 px-2 py-1 text-[10px] text-zinc-500">{Math.round(action.confidence * 100)}% confianza</span></div><h2 className="mt-3 text-lg font-semibold text-white">{action.title}</h2><p className="mt-2 text-xs leading-5 text-zinc-400">{action.reason}</p>
      {action.evidence.length ? <ul className="mt-3 space-y-1.5">{action.evidence.slice(0, 2).map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-zinc-500"><Check className="mt-1 size-3 shrink-0 text-violet-400"/>{item}</li>)}</ul> : null}
      {!action.suggestedMessage ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-300"/><p className="text-xs leading-5 text-zinc-500">El plan no recomienda enviar un mensaje ahora.</p></div> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><Link href={`/intelligence?fan=${encodeURIComponent(fanId)}`} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-400">Atender en IA<ArrowRight className="size-4"/></Link><Link href={`/messages?fan=${encodeURIComponent(fanId)}`} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/5"><MessageCircle className="size-4"/>Abrir chat</Link></div>
    </div>
  </section>;
}
