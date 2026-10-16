"use client";

import { Images, PackageOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ContentLibraryV2 } from "./content-library-v2";
import { PackManager } from "./pack-manager";

type Section = "content" | "packs";

export function ContentLibraryWorkspace({ initialSection = "content" }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection);

  useEffect(() => {
    const sync = () => setSection(new URLSearchParams(window.location.search).get("section") === "packs" ? "packs" : "content");
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function select(next: Section) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "packs") url.searchParams.set("section", "packs");
    else {
      url.searchParams.delete("section");
      url.searchParams.delete("pack");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  return <div>
    <nav aria-label="Secciones de Content Library" className="mb-5 grid gap-2 rounded-2xl border border-white/8 bg-white/[.025] p-2 sm:grid-cols-2">
      <WorkspaceTab active={section === "content"} icon={<Images className="size-5" />} title="Todo el contenido" detail="Fotos, videos, favoritos y organización" onClick={() => select("content")} />
      <WorkspaceTab active={section === "packs"} icon={<PackageOpen className="size-5" />} title="Packs" detail="Productos, precios, portadas y archivos" onClick={() => select("packs")} />
    </nav>
    {section === "content" ? <ContentLibraryV2 /> : <PackManager embedded />}
  </div>;
}

function WorkspaceTab({ active, icon, title, detail, onClick }: { active: boolean; icon: ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${active ? "border-violet-400/30 bg-violet-500 text-white shadow-lg shadow-violet-950/20" : "border-transparent text-zinc-500 hover:border-white/8 hover:bg-white/[.035] hover:text-white"}`}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${active ? "bg-white/15" : "bg-white/5 text-violet-300"}`}>{icon}</span><span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className={`mt-0.5 block truncate text-[10px] ${active ? "text-violet-100/70" : "text-zinc-700"}`}>{detail}</span></span></button>;
}
