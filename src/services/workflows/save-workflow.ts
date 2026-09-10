import type { Prisma, WorkflowStepType } from "@prisma/client";
import { workflowDefinitionInputSchema } from "@/domain/workflows/definition";
import { prisma } from "@/lib/prisma";

function stepData(input: ReturnType<typeof workflowDefinitionInputSchema.parse>["steps"][number], position: number) {
  return {
    position,
    name: input.name,
    type: input.type as WorkflowStepType,
    config: input.config as Prisma.InputJsonValue,
    messageTemplateId: input.messageTemplateId ?? null,
  };
}

async function assertReferencesBelongToCreator(
  creatorId: string,
  input: ReturnType<typeof workflowDefinitionInputSchema.parse>,
) {
  const templateIds = [...new Set(input.steps.flatMap((step) => step.messageTemplateId ? [step.messageTemplateId] : []))];
  const targetIds = [...new Set(input.steps.flatMap((step) => typeof step.config.targetWorkflowId === "string" ? [step.config.targetWorkflowId] : []))];
  const [templates, targets] = await Promise.all([
    prisma.messageTemplate.findMany({ where: { creatorId, id: { in: templateIds } }, select: { id: true, metadata: true } }),
    prisma.workflow.count({ where: { creatorId, id: { in: targetIds }, status: "PUBLISHED", isPrimary: true } }),
  ]);
  if (templates.length !== templateIds.length) throw new Error("WORKFLOW_TEMPLATE_NOT_FOUND");
  if (targets !== targetIds.length) throw new Error("WORKFLOW_TARGET_NOT_FOUND");
  const byId = new Map(templates.map((template) => [template.id, template.metadata]));
  for (const step of input.steps) {
    if (!step.messageTemplateId) continue;
    const value = byId.get(step.messageTemplateId);
    const metadata = typeof value === "object" && value && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const media = Array.isArray(metadata.media) ? metadata.media : [];
    const price = typeof metadata.priceMinor === "number" ? metadata.priceMinor : null;
    const preview = typeof metadata.previewUuid === "string" ? metadata.previewUuid : null;
    const previewExists = preview && media.some((item) => typeof item === "object" && item && "uuid" in item && item.uuid === preview);
    if (step.type === "SEND_PPV" && (!price || price < 300 || !previewExists || media.length < 2)) throw new Error("WORKFLOW_PPV_TEMPLATE_INVALID");
    if (step.type === "SEND_MESSAGE" && price) throw new Error("WORKFLOW_MESSAGE_TEMPLATE_HAS_PRICE");
  }
}

export async function createWorkflow(creatorId: string, payload: unknown) {
  const input = workflowDefinitionInputSchema.parse(payload);
  await assertReferencesBelongToCreator(creatorId, input);
  const baseKey = input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workflow";
  const existing = await prisma.workflow.count({ where: { creatorId, stableKey: { startsWith: baseKey } } });
  const stableKey = existing ? `${baseKey}-${existing + 1}` : baseKey;
  return prisma.workflow.create({
    data: {
      creatorId,
      stableKey,
      name: input.name,
      version: 1,
      priority: input.priority,
      isPrimary: input.isPrimary,
      triggerEvent: input.triggerEvent,
      reentryPolicy: input.reentryPolicy,
      reentryDelayDays: input.reentryPolicy === "AFTER_DELAY" ? input.reentryDelayDays : null,
      sendWindowEnabled: input.sendWindowEnabled,
      sendWindowTimezone: input.sendWindowTimezone,
      sendWindowStartMinute: input.sendWindowStartMinute,
      sendWindowEndMinute: input.sendWindowEndMinute,
      sendWindowDays: input.sendWindowDays,
      sendLimitsEnabled: input.sendLimitsEnabled,
      maxMessagesPerHour: input.maxMessagesPerHour,
      maxMessagesPerDay: input.maxMessagesPerDay,
      minMinutesBetweenFanMessages: input.minMinutesBetweenFanMessages,
      pauseOnFanReply: input.pauseOnFanReply,
      replySilenceMinutes: input.replySilenceMinutes,
      replyAttributionHours: input.replyAttributionHours,
      goalType: input.goalType,
      goalAmountMinor: input.goalType === "SPEND_AMOUNT" ? input.goalAmountMinor : null,
      steps: { create: input.steps.map(stepData) },
    },
    include: { steps: { orderBy: { position: "asc" } } },
  });
}

export async function updateWorkflow(creatorId: string, workflowId: string, payload: unknown) {
  const input = workflowDefinitionInputSchema.parse(payload);
  await assertReferencesBelongToCreator(creatorId, input);
  const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, creatorId } });
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  if (workflow.status !== "DRAFT") throw new Error("WORKFLOW_IMMUTABLE");
  return prisma.$transaction(async (transaction) => {
    await transaction.workflowStep.deleteMany({ where: { workflowId } });
    return transaction.workflow.update({
      where: { id: workflowId },
      data: {
        name: input.name,
        priority: input.priority,
        isPrimary: input.isPrimary,
        triggerEvent: input.triggerEvent,
        reentryPolicy: input.reentryPolicy,
        reentryDelayDays: input.reentryPolicy === "AFTER_DELAY" ? input.reentryDelayDays : null,
        sendWindowEnabled: input.sendWindowEnabled,
        sendWindowTimezone: input.sendWindowTimezone,
        sendWindowStartMinute: input.sendWindowStartMinute,
        sendWindowEndMinute: input.sendWindowEndMinute,
        sendWindowDays: input.sendWindowDays,
        sendLimitsEnabled: input.sendLimitsEnabled,
        maxMessagesPerHour: input.maxMessagesPerHour,
        maxMessagesPerDay: input.maxMessagesPerDay,
        minMinutesBetweenFanMessages: input.minMinutesBetweenFanMessages,
        pauseOnFanReply: input.pauseOnFanReply,
        replySilenceMinutes: input.replySilenceMinutes,
        replyAttributionHours: input.replyAttributionHours,
        goalType: input.goalType,
        goalAmountMinor: input.goalType === "SPEND_AMOUNT" ? input.goalAmountMinor : null,
        steps: { create: input.steps.map(stepData) },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
  });
}
