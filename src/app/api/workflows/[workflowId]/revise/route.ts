import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { editableWorkflowConfig } from "@/domain/workflows/revision";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

export async function POST(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.workflowMutation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const source = await prisma.workflow.findFirst({
    where: { id: (await params).workflowId, creatorId, status: "PUBLISHED" },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!source) return Response.json({ error: "WORKFLOW_NOT_FOUND" }, { status: 404 });

  const existingDraft = await prisma.workflow.findFirst({
    where: { creatorId, stableKey: source.stableKey, status: "DRAFT" },
    orderBy: { version: "desc" },
  });
  if (existingDraft) return Response.json({ workflow: existingDraft, reused: true });

  const latest = await prisma.workflow.aggregate({
    where: { creatorId, stableKey: source.stableKey },
    _max: { version: true },
  });
  const draft = await prisma.workflow.create({
    data: {
      creatorId,
      stableKey: source.stableKey,
      name: source.name,
      version: (latest._max.version ?? source.version) + 1,
      priority: source.priority,
      isPrimary: source.isPrimary,
      triggerEvent: source.triggerEvent,
      reentryPolicy: source.reentryPolicy,
      reentryDelayDays: source.reentryDelayDays,
      sendWindowEnabled: source.sendWindowEnabled,
      sendWindowTimezone: source.sendWindowTimezone,
      sendWindowStartMinute: source.sendWindowStartMinute,
      sendWindowEndMinute: source.sendWindowEndMinute,
      sendWindowDays: source.sendWindowDays as Prisma.InputJsonValue,
      sendLimitsEnabled: source.sendLimitsEnabled,
      maxMessagesPerHour: source.maxMessagesPerHour,
      maxMessagesPerDay: source.maxMessagesPerDay,
      minMinutesBetweenFanMessages: source.minMinutesBetweenFanMessages,
      pauseOnFanReply: source.pauseOnFanReply,
      replySilenceMinutes: source.replySilenceMinutes,
      replyAttributionHours: source.replyAttributionHours,
      goalType: source.goalType,
      goalAmountMinor: source.goalAmountMinor,
      steps: {
        create: source.steps.map((step) => ({
          position: step.position,
          name: step.name,
          type: step.type,
          config: editableWorkflowConfig(step.config) as Prisma.InputJsonValue,
          messageTemplateId: step.messageTemplateId,
        })),
      },
    },
  });
  return Response.json({ workflow: draft }, { status: 201 });
}
