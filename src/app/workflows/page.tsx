import { cookies } from "next/headers";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { WorkflowManager } from "@/features/workflows/workflow-manager";
import { EnrollmentPanel } from "@/features/workflows/enrollment-panel";
import { WorkflowAnalyticsPanel } from "@/features/workflows/workflow-analytics-panel";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import {
  activityRetentionCutoff,
  workflowActivityEventTypes,
} from "@/domain/workflows/activity";
import {
  audienceSegments,
  audienceSegmentLabels,
  buildAudienceWhere,
} from "@/domain/workflows/audience";
import {
  buildWorkflowStepAnalytics,
  type WorkflowAnalyticsEvent,
} from "@/domain/workflows/step-analytics";

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const queryParams = await searchParams;
  const initialQuery = (Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q)?.trim().slice(0, 80) ?? "";
  const creatorId = readCreatorSession(
    (await cookies()).get(CREATOR_SESSION_COOKIE)?.value,
  );
  const [
    records,
    templates,
    fanRecords,
    enrollmentRecords,
    logRecords,
    allActivityCount,
    oldActivityCount,
    analyticsRecords,
    settingsRecord,
  ] = creatorId
    ? await Promise.all([
        prisma.workflow.findMany({
          where: { creatorId },
          orderBy: [
            { status: "asc" },
            { priority: "desc" },
            { updatedAt: "desc" },
          ],
          include: {
            steps: { orderBy: { position: "asc" } },
            enrollments: {
              where: { status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
              select: { id: true },
            },
            _count: { select: { enrollments: true } },
          },
        }),
        prisma.messageTemplate.findMany({
          where: { creatorId, status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, type: true, metadata: true },
        }),
        prisma.fan.findMany({
          where: {
            creatorId,
            isCreatorAccount: false,
            OR: [
              { isFollower: true },
              { isSubscriber: true },
              { isExpiredSubscriber: true },
            ],
          },
          orderBy: [{ displayName: "asc" }, { username: "asc" }],
          select: { id: true, displayName: true, username: true },
        }),
        prisma.workflowEnrollment.findMany({
          where: { creatorId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
          orderBy: { updatedAt: "desc" },
          include: {
            fan: { select: { displayName: true, username: true } },
            workflow: { select: { name: true } },
            currentStep: { select: { name: true } },
            _count: { select: { executions: true } },
          },
        }),
        prisma.automationLog.findMany({
          where: {
            creatorId,
            eventType: { in: [...workflowActivityEventTypes] },
          },
          orderBy: { occurredAt: "desc" },
          take: 20,
          include: { fan: { select: { displayName: true, username: true } } },
        }),
        prisma.automationLog.count({
          where: {
            creatorId,
            eventType: { in: [...workflowActivityEventTypes] },
          },
        }),
        prisma.automationLog.count({
          where: {
            creatorId,
            eventType: { in: [...workflowActivityEventTypes] },
            occurredAt: { lt: activityRetentionCutoff(new Date()) },
          },
        }),
        prisma.workflowEnrollment.findMany({
          where: { creatorId },
          select: {
            id: true,
            workflowId: true,
            fanId: true,
            status: true,
            startedAt: true,
            logs: {
              where: { eventType: { in: ["WORKFLOW_MESSAGE_SENT", "WORKFLOW_PPV_SENT", "WORKFLOW_FAN_REPLIED", "WORKFLOW_GOAL_COMPLETED"] } },
              select: {
                eventType: true,
                occurredAt: true,
                metadata: true,
                execution: {
                  select: {
                    step: {
                      select: {
                        id: true,
                        name: true,
                        messageTemplate: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.settings.findUnique({ where: { creatorId } }),
      ])
    : [[], [], [], [], [], 0, 0, [], null];
  const workflows = records.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    version: workflow.version,
    priority: workflow.priority,
    status: workflow.status,
    isPrimary: workflow.isPrimary,
    triggerEvent:
      workflow.triggerEvent as (typeof import("@/domain/workflows/triggers").workflowTriggers)[number],
    reentryPolicy: workflow.reentryPolicy,
    reentryDelayDays: workflow.reentryDelayDays,
    sendWindowEnabled: workflow.sendWindowEnabled,
    sendWindowTimezone: workflow.sendWindowTimezone,
    sendWindowStartMinute: workflow.sendWindowStartMinute,
    sendWindowEndMinute: workflow.sendWindowEndMinute,
    sendWindowDays: Array.isArray(workflow.sendWindowDays) ? workflow.sendWindowDays.filter((day): day is number => typeof day === "number") : [0, 1, 2, 3, 4, 5, 6],
    sendLimitsEnabled: workflow.sendLimitsEnabled,
    maxMessagesPerHour: workflow.maxMessagesPerHour,
    maxMessagesPerDay: workflow.maxMessagesPerDay,
    minMinutesBetweenFanMessages: workflow.minMinutesBetweenFanMessages,
    pauseOnFanReply: workflow.pauseOnFanReply,
    replySilenceMinutes: workflow.replySilenceMinutes,
    replyAttributionHours: workflow.replyAttributionHours,
    goalType: workflow.goalType,
    goalAmountMinor: workflow.goalAmountMinor,
    publishedAt: workflow.publishedAt?.toISOString() ?? null,
    enrollments: workflow._count.enrollments,
    activeEnrollments: workflow.enrollments.length,
    steps: workflow.steps.map((step) => ({
      name: step.name,
      type: step.type as
        | "SEND_MESSAGE"
        | "WAIT"
        | "SEND_PPV"
        | "CONDITION"
        | "CHANGE_WORKFLOW"
        | "END",
      messageTemplateId: step.messageTemplateId,
      config: step.config as Record<string, unknown>,
    })),
  }));
  const templateOptions = templates.map((template) => {
    const metadata = typeof template.metadata === "object" && template.metadata && !Array.isArray(template.metadata) ? template.metadata as Record<string, unknown> : {};
    return { id: template.id, name: template.name, type: template.type, priceMinor: typeof metadata.priceMinor === "number" ? metadata.priceMinor : null, previewUuid: typeof metadata.previewUuid === "string" ? metadata.previewUuid : null };
  });
  const timeToMinute = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  const workflowDefaults = {
    sendWindowEnabled: settingsRecord?.sendWindowEnabled ?? false,
    sendWindowTimezone: settingsRecord?.timezone ?? "America/Monterrey",
    sendWindowStartMinute: timeToMinute(settingsRecord?.sendingWindowStart ?? "09:00"),
    sendWindowEndMinute: timeToMinute(settingsRecord?.sendingWindowEnd ?? "21:00"),
    sendWindowDays: Array.isArray(settingsRecord?.sendingWindowDays) ? settingsRecord.sendingWindowDays.filter((value): value is number => typeof value === "number") : [0, 1, 2, 3, 4, 5, 6],
    sendLimitsEnabled: settingsRecord?.sendLimitsEnabled ?? false,
    maxMessagesPerHour: settingsRecord?.maxMessagesPerHour ?? 30,
    maxMessagesPerDay: settingsRecord?.maxMessagesPerDay ?? 200,
    minMinutesBetweenFanMessages: settingsRecord?.minMinutesBetweenFanMessages ?? 60,
  };

  const fans = fanRecords.map((fan) => ({
    id: fan.id,
    name: fan.displayName || fan.username || "Fan sin nombre",
    username: fan.username,
  }));
  const enrollments = enrollmentRecords.map((enrollment) => ({
    id: enrollment.id,
    status: enrollment.status,
    fanName:
      enrollment.fan.displayName || enrollment.fan.username || "Fan sin nombre",
    fanUsername: enrollment.fan.username,
    workflowName: enrollment.workflow.name,
    currentStepName: enrollment.currentStep?.name ?? null,
    nextRunAt: enrollment.nextRunAt?.toISOString() ?? null,
    pauseReason: enrollment.pauseReason,
    hasStarted:
      enrollment._count.executions > 0 ||
      enrollment.nextRunAt !== null ||
      enrollment.lastRunAt !== null ||
      enrollment.pausedAt !== null,
    pausedRemainingSeconds: enrollment.pausedRemainingSeconds,
  }));
  const activity = logRecords.map((log) => ({
    id: log.id,
    eventType: log.eventType,
    explanation: log.explanation,
    occurredAt: log.occurredAt.toISOString(),
    fanName: log.fan?.displayName || log.fan?.username || null,
  }));
  const audiences = creatorId
    ? await Promise.all(
        audienceSegments.map(async (id) => ({
          id,
          label: audienceSegmentLabels[id],
          count: await prisma.fan.count({
            where: buildAudienceWhere(creatorId, [id], []),
          }),
        })),
      )
    : [];
  const workflowAnalytics = workflows.map((workflow) => {
    const enrollmentsForWorkflow = analyticsRecords.filter((enrollment) => enrollment.workflowId === workflow.id);
    const uniqueFans = new Set(enrollmentsForWorkflow.map((enrollment) => enrollment.fanId));
    const repliedFans = new Set(enrollmentsForWorkflow.flatMap((enrollment) => enrollment.logs.some((log) => log.eventType === "WORKFLOW_FAN_REPLIED") ? [enrollment.fanId] : []));
    const conversionLogs = enrollmentsForWorkflow.flatMap((enrollment) => enrollment.logs.filter((log) => log.eventType === "WORKFLOW_GOAL_COMPLETED").map((log) => ({ ...log, fanId: enrollment.fanId, startedAt: enrollment.startedAt })));
    const convertedFans = new Set(conversionLogs.map((log) => log.fanId));
    const attributedRevenueMinor = conversionLogs.reduce((total, log) => {
      const metadata = typeof log.metadata === "object" && log.metadata && !Array.isArray(log.metadata) ? log.metadata as Record<string, unknown> : {};
      return total + (typeof metadata.amountMinor === "number" ? metadata.amountMinor : 0);
    }, 0);
    const conversionMinutes = conversionLogs.map((log) => Math.max(0, (log.occurredAt.getTime() - log.startedAt.getTime()) / 60_000));
    return {
      workflowId: workflow.id,
      workflowName: workflow.name,
      uniqueFans: uniqueFans.size,
      enrollments: enrollmentsForWorkflow.length,
      active: enrollmentsForWorkflow.filter((enrollment) => ["ACTIVE", "WAITING", "PAUSED"].includes(enrollment.status)).length,
      completed: enrollmentsForWorkflow.filter((enrollment) => enrollment.status === "COMPLETED").length,
      cancelled: enrollmentsForWorkflow.filter((enrollment) => enrollment.status === "CANCELLED").length,
      failed: enrollmentsForWorkflow.filter((enrollment) => enrollment.status === "FAILED").length,
      messagesSent: enrollmentsForWorkflow.reduce((total, enrollment) => total + enrollment.logs.filter((log) => log.eventType === "WORKFLOW_MESSAGE_SENT" || log.eventType === "WORKFLOW_PPV_SENT").length, 0),
      fansReplied: repliedFans.size,
      conversions: convertedFans.size,
      conversionRate: uniqueFans.size ? convertedFans.size / uniqueFans.size * 100 : 0,
      attributedRevenueMinor,
      averageConversionMinutes: conversionMinutes.length ? conversionMinutes.reduce((total, minutes) => total + minutes, 0) / conversionMinutes.length : null,
    };
  });
  const stepAnalyticsEvents: WorkflowAnalyticsEvent[] = analyticsRecords.flatMap((enrollment) =>
    enrollment.logs.flatMap((log): WorkflowAnalyticsEvent[] => {
      const metadata = typeof log.metadata === "object" && log.metadata && !Array.isArray(log.metadata) ? log.metadata as Record<string, unknown> : {};
      if (log.eventType === "WORKFLOW_FAN_REPLIED") {
        return [{ enrollmentId: enrollment.id, workflowId: enrollment.workflowId, fanId: enrollment.fanId, type: "REPLY", occurredAt: log.occurredAt }];
      }
      if (log.eventType === "WORKFLOW_GOAL_COMPLETED") {
        return [{ enrollmentId: enrollment.id, workflowId: enrollment.workflowId, fanId: enrollment.fanId, type: "CONVERSION", occurredAt: log.occurredAt, amountMinor: typeof metadata.amountMinor === "number" ? metadata.amountMinor : 0 }];
      }
      const step = log.execution?.step;
      const template = step?.messageTemplate;
      if (!step || !template) return [];
      return [{
        enrollmentId: enrollment.id,
        workflowId: enrollment.workflowId,
        fanId: enrollment.fanId,
        type: "SEND",
        occurredAt: log.occurredAt,
        stepId: step.id,
        stepName: step.name,
        templateId: template.id,
        templateName: template.name,
        messageKind: log.eventType === "WORKFLOW_PPV_SENT" ? "PPV" : "MESSAGE",
      }];
    }),
  );
  const stepAnalytics = buildWorkflowStepAnalytics(stepAnalyticsEvents);
  const unstartedEnrollmentIds = enrollments.filter((enrollment) => !enrollment.hasStarted).map((enrollment) => enrollment.id);
  const enrollmentProgress = {
    assigned: unstartedEnrollmentIds.length,
    active: analyticsRecords.filter((item) => item.status === "ACTIVE" && !unstartedEnrollmentIds.includes(item.id)).length,
    waiting: analyticsRecords.filter((item) => item.status === "WAITING").length,
    paused: analyticsRecords.filter((item) => item.status === "PAUSED").length,
    completed: analyticsRecords.filter((item) => item.status === "COMPLETED").length,
    cancelled: analyticsRecords.filter((item) => item.status === "CANCELLED").length,
    failed: analyticsRecords.filter((item) => item.status === "FAILED").length,
  };

  return (
    <div className="flex min-h-screen bg-[#101218] text-zinc-100">
      <LiveRefresh />
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-375 px-4 py-6 sm:px-5 sm:py-8 md:px-8">
          <div className="mb-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">
              Automatización
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Workflows
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Construye estrategias versionadas, explicables y validadas antes
              de cada acción.
            </p>
          </div>
          {creatorId ? (
            <>
              <WorkflowManager workflows={workflows} templates={templateOptions} defaults={workflowDefaults} analytics={workflowAnalytics} initialQuery={initialQuery} />
              <WorkflowAnalyticsPanel analytics={workflowAnalytics} stepAnalytics={stepAnalytics} />
              <EnrollmentPanel
                fans={fans}
                audiences={audiences}
                workflows={workflows.filter(
                  (workflow) =>
                    workflow.status === "PUBLISHED" && workflow.isPrimary,
                )}
                enrollments={enrollments}
                unstartedEnrollmentIds={unstartedEnrollmentIds}
                enrollmentProgress={enrollmentProgress}
                activity={activity}
                activityCounts={{
                  all: allActivityCount,
                  olderThan90Days: oldActivityCount,
                }}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-amber-200">
              Conecta Fanvue para crear workflows.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
