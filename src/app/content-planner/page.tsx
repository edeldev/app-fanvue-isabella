import { CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { ContentPlanner } from "@/components/content-planner";

export default function ContentPlannerPage() {
  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar />
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="mb-2 flex items-center gap-2 text-violet-400"><CalendarClock className="size-4" /><p className="text-xs font-medium uppercase tracking-[.18em]">Content Studio</p></div><h1 className="text-3xl font-semibold tracking-tight text-white">Publica y programa contenido</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Elige contenido desde tu Mac, Bóveda o Content Library; conviértelo en PPV y genera captions visuales con IA.</p></div><div className="flex flex-wrap gap-2"><span className="flex items-center gap-2 rounded-full border border-violet-400/15 bg-violet-400/[.05] px-3 py-2 text-[10px] text-violet-200"><Sparkles className="size-3.5" />IA visual</span><span className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[.05] px-3 py-2 text-[10px] text-emerald-200"><ShieldCheck className="size-3.5" />Solo contenido de adultos</span></div></header>
      <ContentPlanner />
    </main>
  </div></div>;
}

