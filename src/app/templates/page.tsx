import { cookies } from "next/headers";
import { FileImage, FileText, Images, LockKeyhole, Plus } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { TemplateForm } from "@/components/template-form";
import { TemplatesLibrary, type TemplateLibraryItem } from "@/components/templates-library";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const object = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
function templateMetadata(value: unknown) {
  const metadata = object(value);
  const media = Array.isArray(metadata.media) ? metadata.media.flatMap((value) => { const item = object(value); return typeof item.uuid === "string" && typeof item.name === "string" && typeof item.mediaType === "string" ? [{ uuid: item.uuid, name: item.name, mediaType: item.mediaType }] : []; }) : [];
  return { media, priceMinor: typeof metadata.priceMinor === "number" ? metadata.priceMinor : null, previewUuid: typeof metadata.previewUuid === "string" ? metadata.previewUuid : null };
}

export default async function TemplatesPage() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const records = creatorId ? await prisma.messageTemplate.findMany({ where: { creatorId }, orderBy: { updatedAt: "desc" } }) : [];
  const templates: TemplateLibraryItem[] = records.map((template) => ({ id: template.id, name: template.name, text: template.text, type: template.type, category: template.category, status: template.status, updatedAt: template.updatedAt.toISOString(), ...templateMetadata(template.metadata) }));
  const ppvCount = templates.filter((template) => Boolean(template.priceMinor)).length;
  const mediaCount = templates.filter((template) => template.media.length > 0 && !template.priceMinor).length;
  const textCount = templates.filter((template) => template.media.length === 0 && !template.priceMinor).length;
  const stats = [
    { label: "Total", value: templates.length, detail: "plantillas guardadas", icon: FileText, tone: "text-violet-300 bg-violet-400/10" },
    { label: "Solo texto", value: textCount, detail: "listas para conversar", icon: FileImage, tone: "text-sky-300 bg-sky-400/10" },
    { label: "Multimedia gratis", value: mediaCount, detail: "fotos o videos sin precio", icon: Images, tone: "text-fuchsia-300 bg-fuchsia-400/10" },
    { label: "PPV", value: ppvCount, detail: "contenido de pago", icon: LockKeyhole, tone: "text-amber-300 bg-amber-400/10" },
  ];

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar />
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
      <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Biblioteca</p><h1 className="text-3xl font-semibold tracking-tight text-white">Plantillas de mensajes</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Organiza respuestas, campañas y contenido PPV reutilizable para chats y automatizaciones.</p></div><a href="#new-template" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400"><Plus className="size-4" />Nueva plantilla</a></header>
      <section aria-label="Resumen de plantillas" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><div className="flex items-center justify-between gap-3"><span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4" /></span><strong className="text-2xl font-semibold tracking-tight text-white">{value}</strong></div><p className="mt-3 text-xs font-medium text-zinc-300">{label}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></div>)}</section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <TemplatesLibrary templates={templates} />
        <aside id="new-template" className="scroll-mt-20 rounded-2xl border border-violet-400/15 bg-[#15171d] shadow-xl shadow-black/15 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto"><div className="border-b border-white/8 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500 text-white"><Plus className="size-5" /></span><div><h2 className="font-semibold text-white">Crear plantilla</h2><p className="mt-1 text-[11px] text-zinc-500">Texto, multimedia o PPV desde un solo lugar.</p></div></div></div><div className="p-5"><TemplateForm /></div></aside>
      </div>
    </main>
  </div></div>;
}
