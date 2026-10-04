import { Images, Layers3, PackageOpen, Plus } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { ContentLibraryV2 } from "@/components/content-library/content-library-v2";

export default function ContentLibraryPage() {
  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar />
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Contenido de Isabella</p><h1 className="text-3xl font-semibold tracking-tight text-white">Content Library</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Tu biblioteca central de fotos y videos. Agrega desde tu Mac o Fanvue y organízalo todo en un solo lugar.</p></div><div className="flex flex-wrap items-center gap-2"><a href="/content-library/packs" className="flex h-10 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/[.06] px-4 text-xs font-medium text-violet-300 hover:bg-violet-400/10"><PackageOpen className="size-4" />Ver Packs</a><span className="flex items-center gap-1.5 rounded-full border border-white/8 px-3 py-1.5 text-[11px] text-zinc-600"><Images className="size-3.5" />Biblioteca unificada</span></div></header>
      <ContentLibraryV2 />
      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Herramientas de Content Library"><div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><Layers3 className="size-5 text-violet-300" /><h2 className="mt-3 text-sm font-medium text-zinc-200">Categorías, Collections y Tags</h2><p className="mt-1 text-xs leading-5 text-zinc-600">Organiza cada asset y encuéntralo mediante filtros combinables.</p></div><div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><PackageOpen className="size-5 text-violet-300" /><h2 className="mt-3 text-sm font-medium text-zinc-200">Packs mixtos y trazabilidad</h2><p className="mt-1 text-xs leading-5 text-zinc-600">Reutiliza fotos y videos y consulta en qué Packs, Collections y plantillas aparecen.</p></div><div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><Plus className="size-5 text-violet-300" /><h2 className="mt-3 text-sm font-medium text-zinc-200">Integración futura</h2><p className="mt-1 text-xs leading-5 text-zinc-600">La arquitectura queda preparada para seleccionar Content Library y Packs desde mensajes.</p></div></section>
    </main>
  </div></div>;
}
