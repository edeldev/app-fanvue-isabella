import { Images } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { ContentLibraryWorkspace } from "@/components/content-library/content-library-workspace";

export default async function ContentLibraryPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  const params = await searchParams;
  const section = (Array.isArray(params.section) ? params.section[0] : params.section) === "packs" ? "packs" : "content";
  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar />
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Contenido de Isabella</p><h1 className="text-3xl font-semibold tracking-tight text-white">Content Library</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Tu espacio central para administrar archivos y convertirlos en Packs reutilizables.</p></div><span className="flex w-fit items-center gap-1.5 rounded-full border border-white/8 px-3 py-1.5 text-[11px] text-zinc-600"><Images className="size-3.5" />Biblioteca unificada</span></header>
      <ContentLibraryWorkspace key={section} initialSection={section} />
    </main>
  </div></div>;
}
