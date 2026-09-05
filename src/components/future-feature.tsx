import type { LucideIcon } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export function FutureFeature({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar /><main className="mx-auto max-w-[1500px] px-5 py-8 md:px-8"><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Próxima fase</p><h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1><div className="mt-8 grid min-h-96 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-8 text-center"><div><div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><Icon className="size-6" /></div><h2 className="text-lg font-medium text-white">Base preparada</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p><span className="mt-5 inline-block rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">Disponible en una fase futura</span></div></div></main></div></div>;
}
