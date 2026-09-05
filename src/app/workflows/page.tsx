import { cookies } from "next/headers";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { WorkflowManager } from "@/features/workflows/workflow-manager";
import { EnrollmentPanel } from "@/features/workflows/enrollment-panel";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export default async function WorkflowsPage() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const [records, templates, fanRecords, enrollmentRecords] = creatorId ? await Promise.all([
    prisma.workflow.findMany({
      where: { creatorId },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      include: {
        steps: { orderBy: { position: "asc" } },
        enrollments: { where: { status: { in: ["ACTIVE", "WAITING", "PAUSED"] } }, select: { id: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.messageTemplate.findMany({ where: { creatorId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.fan.findMany({
      where: { creatorId, isCreatorAccount: false, OR: [{ isFollower: true }, { isSubscriber: true }, { isExpiredSubscriber: true }] },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: { id: true, displayName: true, username: true },
    }),
    prisma.workflowEnrollment.findMany({
      where: { creatorId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
      orderBy: { updatedAt: "desc" },
      include: { fan: { select: { displayName: true, username: true } }, workflow: { select: { name: true } }, currentStep: { select: { name: true } } },
    }),
  ]) : [[], [], [], []];
  const workflows = records.map((workflow) => ({
    id: workflow.id, name: workflow.name, version: workflow.version, priority: workflow.priority,
    status: workflow.status, isPrimary: workflow.isPrimary,
    publishedAt: workflow.publishedAt?.toISOString() ?? null,
    enrollments: workflow._count.enrollments,
    activeEnrollments: workflow.enrollments.length,
    steps: workflow.steps.map((step) => ({ name: step.name, type: step.type as "SEND_MESSAGE" | "WAIT" | "SEND_PPV" | "CONDITION" | "CHANGE_WORKFLOW" | "END", messageTemplateId: step.messageTemplateId, config: step.config as Record<string, unknown> })),
  }));

  const fans = fanRecords.map((fan) => ({ id: fan.id, name: fan.displayName || fan.username || "Fan sin nombre", username: fan.username }));
  const enrollments = enrollmentRecords.map((enrollment) => ({
    id: enrollment.id, status: enrollment.status, fanName: enrollment.fan.displayName || enrollment.fan.username || "Fan sin nombre",
    fanUsername: enrollment.fan.username, workflowName: enrollment.workflow.name,
    currentStepName: enrollment.currentStep?.name ?? null, nextRunAt: enrollment.nextRunAt?.toISOString() ?? null,
    pauseReason: enrollment.pauseReason,
  }));

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar /><main className="mx-auto max-w-375 px-5 py-8 md:px-8"><div className="mb-8"><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Automatización</p><h1 className="text-3xl font-semibold tracking-tight text-white">Workflows</h1><p className="mt-2 text-sm text-zinc-500">Construye estrategias versionadas, explicables y validadas antes de cada acción.</p></div>{creatorId ? <><WorkflowManager workflows={workflows} templates={templates} /><EnrollmentPanel fans={fans} workflows={workflows.filter((workflow) => workflow.status === "PUBLISHED" && workflow.isPrimary)} enrollments={enrollments} /></> : <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-amber-200">Conecta Fanvue para crear workflows.</div>}</main></div></div>;
}
