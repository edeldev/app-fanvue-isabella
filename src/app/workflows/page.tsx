import { cookies } from "next/headers";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { WorkflowManager } from "@/features/workflows/workflow-manager";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export default async function WorkflowsPage() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const [records, templates] = creatorId ? await Promise.all([
    prisma.workflow.findMany({
      where: { creatorId },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      include: { steps: { orderBy: { position: "asc" } }, _count: { select: { enrollments: true } } },
    }),
    prisma.messageTemplate.findMany({ where: { creatorId, status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
  ]) : [[], []];
  const workflows = records.map((workflow) => ({
    id: workflow.id, name: workflow.name, version: workflow.version, priority: workflow.priority,
    status: workflow.status, isPrimary: workflow.isPrimary,
    publishedAt: workflow.publishedAt?.toISOString() ?? null,
    enrollments: workflow._count.enrollments,
    steps: workflow.steps.map((step) => ({ name: step.name, type: step.type as "SEND_MESSAGE" | "WAIT" | "SEND_PPV" | "CONDITION" | "CHANGE_WORKFLOW" | "END", messageTemplateId: step.messageTemplateId, config: step.config as Record<string, unknown> })),
  }));

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar /><main className="mx-auto max-w-375 px-5 py-8 md:px-8"><div className="mb-8"><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Automatización</p><h1 className="text-3xl font-semibold tracking-tight text-white">Workflows</h1><p className="mt-2 text-sm text-zinc-500">Construye estrategias versionadas, explicables y validadas antes de cada acción.</p></div>{creatorId ? <WorkflowManager workflows={workflows} templates={templates} /> : <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-amber-200">Conecta Fanvue para crear workflows.</div>}</main></div></div>;
}
