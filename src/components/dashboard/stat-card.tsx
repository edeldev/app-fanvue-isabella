import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return <article className="rounded-2xl border border-white/8 bg-white/[.035] p-5"><div className="mb-6 flex items-center justify-between"><p className="text-sm text-zinc-400">{label}</p><div className="grid size-9 place-items-center rounded-lg bg-violet-500/10 text-violet-300"><Icon className="size-4" /></div></div><p className="text-3xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1.5 text-xs text-zinc-500">{detail}</p></article>;
}
