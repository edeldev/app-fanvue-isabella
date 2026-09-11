import { cookies } from "next/headers";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { TemplateForm } from "@/components/template-form";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";

const labels: Record<string, string> = {
  WELCOME: "Bienvenida",
  FOLLOW_UP: "Seguimiento",
  RENEWAL: "Renovación",
  SALES: "Venta",
  VIP: "VIP",
  REACTIVATION: "Reactivación",
  GENERAL: "General",
};
const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
function templateMetadata(value: unknown) {
  const metadata = object(value);
  const media = Array.isArray(metadata.media)
    ? metadata.media.flatMap((value) => {
        const item = object(value);
        return typeof item.uuid === "string" &&
          typeof item.name === "string" &&
          typeof item.mediaType === "string"
          ? [{ uuid: item.uuid, name: item.name, mediaType: item.mediaType }]
          : [];
      })
    : [];
  return {
    media,
    priceMinor:
      typeof metadata.priceMinor === "number" ? metadata.priceMinor : null,
    previewUuid:
      typeof metadata.previewUuid === "string" ? metadata.previewUuid : null,
  };
}

export default async function TemplatesPage() {
  const creatorId = readCreatorSession(
    (await cookies()).get(CREATOR_SESSION_COOKIE)?.value,
  );
  const templates = creatorId
    ? await prisma.messageTemplate.findMany({
        where: { creatorId },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  return (
    <div className="flex min-h-screen bg-[#101218] text-zinc-100">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1300px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
          <div className="mb-7">
            <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">
              Biblioteca
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Plantillas de mensajes
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Texto, medios y PPV reutilizables en chats y workflows.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
            <section className="h-fit rounded-2xl border border-white/8 bg-white/[.025] p-5">
              <div className="mb-5 flex items-center gap-2">
                <Plus className="size-4 text-violet-400" />
                <h2 className="font-medium">Nueva plantilla</h2>
              </div>
              <TemplateForm />
            </section>
            <section className="space-y-3">
              {templates.map((template) => {
                const metadata = templateMetadata(template.metadata);
                return (
                  <details
                    key={template.id}
                    className="group rounded-2xl border border-white/8 bg-white/[.025] open:border-violet-400/20"
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-4 p-5">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{template.name}</h3>
                          <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-zinc-500">
                            {labels[template.category] ?? template.category}
                          </span>
                          {metadata.media.length ? (
                            <span className="text-[10px] text-sky-400">
                              {metadata.media.length} archivos
                            </span>
                          ) : null}
                          {metadata.priceMinor ? (
                            <span className="text-[10px] text-amber-400">
                              PPV ${(metadata.priceMinor / 100).toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-zinc-500">
                          {template.text || "Solo contenido multimedia"}
                        </p>
                      </div>
                      <Pencil className="size-4 text-zinc-600" />
                    </summary>
                    <div className="border-t border-white/8 p-5">
                      <TemplateForm
                        template={{
                          id: template.id,
                          name: template.name,
                          text: template.text,
                          category: template.category,
                          ...metadata,
                        }}
                      />
                      <form
                        action="/api/templates"
                        method="post"
                        className="mt-3"
                      >
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={template.id} />
                        <button className="flex items-center gap-2 text-xs text-red-400">
                          <Trash2 className="size-3.5" />
                          Eliminar plantilla
                        </button>
                      </form>
                    </div>
                  </details>
                );
              })}
              {templates.length === 0 ? (
                <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-white/10 text-center">
                  <div>
                    <FileText className="mx-auto mb-3 size-7 text-zinc-700" />
                    <p className="text-sm">Todavía no tienes plantillas</p>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
