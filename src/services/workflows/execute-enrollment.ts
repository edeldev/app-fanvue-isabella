import type { Prisma } from "@/generated/prisma/client";
import { renderTemplateVariables } from "@/domain/workflows/template-variables";
import { fanvueRequest } from "@/lib/fanvue/client";
import { sentMessageSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

type LoadedEnrollment = NonNullable<Awaited<ReturnType<typeof loadEnrollment>>>;
type StepRecord = LoadedEnrollment["currentStep"];

export async function executeEnrollmentStep(creatorId: string, enrollmentId: string, now = new Date()) {
  const enrollment = await loadEnrollment(creatorId, enrollmentId);
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");
  if (enrollment.status === "PAUSED") throw new Error("ENROLLMENT_PAUSED");
  if (!(["ACTIVE", "WAITING"] as const).includes(enrollment.status as "ACTIVE" | "WAITING")) throw new Error("ENROLLMENT_NOT_EXECUTABLE");
  if (!enrollment.currentStep) throw new Error("ENROLLMENT_STEP_NOT_FOUND");
  if (enrollment.nextRunAt && enrollment.nextRunAt > now) throw new Error(`ENROLLMENT_NOT_DUE:${enrollment.nextRunAt.toISOString()}`);

  const step = enrollment.currentStep;
  if (["SEND_PPV", "CONDITION", "CHANGE_WORKFLOW", "SEND_OFFER"].includes(step.type)) {
    throw new Error(`STEP_NOT_IMPLEMENTED:${step.type}`);
  }

  const idempotencyKey = `${enrollment.id}:${step.id}`;
  const previous = await prisma.automationExecution.findUnique({ where: { idempotencyKey } });
  if (previous?.status === "SUCCESS") throw new Error("STEP_ALREADY_EXECUTED");
  if (previous?.status === "RUNNING") throw new Error("STEP_ALREADY_RUNNING");

  const execution = previous
    ? await prisma.automationExecution.update({ where: { id: previous.id }, data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: now, finishedAt: null, reason: null, reasonCode: null } })
    : await prisma.automationExecution.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, stepId: step.id, idempotencyKey, status: "RUNNING", startedAt: now } });

  try {
    if (step.type === "SEND_MESSAGE") {
      return await executeMessage(enrollment, step, execution.id, now);
    }
    return await finishLocalStep(enrollment, step, execution.id, now);
  } catch (error) {
    await prisma.$transaction([
      prisma.automationExecution.update({ where: { id: execution.id }, data: { status: "FAILED", decision: "RETRY", reasonCode: "STEP_EXECUTION_FAILED", reason: error instanceof Error ? error.message : "Error inesperado", finishedAt: new Date() } }),
      prisma.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, executionId: execution.id, eventType: "WORKFLOW_STEP_FAILED", level: "ERROR", reasonCode: "STEP_EXECUTION_FAILED", explanation: `${step.name} falló y no avanzó.`, metadata: { error: error instanceof Error ? error.message : "Unknown error" } } }),
    ]);
    throw error;
  }
}

async function executeMessage(enrollment: NonNullable<Awaited<ReturnType<typeof loadEnrollment>>>, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  if (!step.messageTemplate || step.messageTemplate.status !== "ACTIVE") throw new Error("WORKFLOW_TEMPLATE_UNAVAILABLE");
  const metadata = readTemplateMetadata(step.messageTemplate.metadata);
  if (metadata.priceMinor) throw new Error("WORKFLOW_TEMPLATE_REQUIRES_PPV_STEP");
  const text = renderTemplateVariables(step.messageTemplate.text, enrollment.fan);
  if (!text && metadata.mediaUuids.length === 0) throw new Error("WORKFLOW_TEMPLATE_EMPTY");

  const token = await getValidFanvueAccessToken(enrollment.creatorId);
  const sent = await fanvueRequest(`/v1/chats/${enrollment.fan.fanvueUserId}/message`, token, sentMessageSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text || null, mediaUuids: metadata.mediaUuids, mediaPreviewUuid: null, price: null }),
  });
  const conversation = await prisma.conversation.upsert({
    where: { creatorId_fanId: { creatorId: enrollment.creatorId, fanId: enrollment.fanId } },
    update: { lastMessageAt: now, lastOutboundAt: now },
    create: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, lastMessageAt: now, lastOutboundAt: now },
  });
  const next = nextStep(enrollment.workflow.steps, step.position);
  const schedule = scheduleNext(next, now);

  await prisma.$transaction([
    prisma.message.upsert({
      where: { creatorId_fanvueMessageId: { creatorId: enrollment.creatorId, fanvueMessageId: sent.messageUuid } },
      update: { text, templateId: step.messageTemplate.id, status: "SENT", mediaUuids: metadata.mediaUuids },
      create: { creatorId: enrollment.creatorId, conversationId: conversation.id, fanvueMessageId: sent.messageUuid, templateId: step.messageTemplate.id, direction: "OUTBOUND", status: "SENT", text, mediaUuids: metadata.mediaUuids, sentAt: now },
    }),
    prisma.automationExecution.update({ where: { id: executionId }, data: { status: "SUCCESS", decision: "SEND", reason: `Mensaje ${sent.messageUuid} enviado.`, evidence: { fanvueMessageId: sent.messageUuid }, finishedAt: new Date() } }),
    prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { ...schedule, lastRunAt: now, lastResult: { stepId: step.id, fanvueMessageId: sent.messageUuid } } }),
    prisma.automationLog.create({ data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: "WORKFLOW_MESSAGE_SENT", explanation: `${step.name}: plantilla ${step.messageTemplate.name} enviada a ${enrollment.fan.displayName || enrollment.fan.username || "fan"}.`, metadata: { templateId: step.messageTemplate.id, fanvueMessageId: sent.messageUuid } } }),
  ]);
  return { outcome: "MESSAGE_SENT", nextStep: next?.name ?? null };
}

async function finishLocalStep(enrollment: NonNullable<Awaited<ReturnType<typeof loadEnrollment>>>, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  const next = nextStep(enrollment.workflow.steps, step.position);
  const schedule = scheduleNext(next, now);
  const completed = step.type === "END";
  await prisma.$transaction([
    prisma.automationExecution.update({ where: { id: executionId }, data: { status: "SUCCESS", decision: completed ? "CANCEL" : "WAIT", reason: completed ? "Workflow finalizado." : "Espera cumplida.", finishedAt: new Date() } }),
    prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: completed ? { status: "COMPLETED", currentStepId: null, nextRunAt: null, completedAt: now, lastRunAt: now } : { ...schedule, lastRunAt: now } }),
    prisma.automationLog.create({ data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: completed ? "WORKFLOW_COMPLETED" : "WORKFLOW_WAIT_COMPLETED", explanation: completed ? `${enrollment.workflow.name} finalizó correctamente.` : `${step.name}: la espera terminó; continúa en ${next?.name || "el final"}.` } }),
  ]);
  return { outcome: completed ? "COMPLETED" : "WAIT_COMPLETED", nextStep: next?.name ?? null };
}

function scheduleNext(step: { id: string; type: string; config: Prisma.JsonValue } | undefined, now: Date) {
  if (!step) return { status: "COMPLETED" as const, currentStepId: null, nextRunAt: null, completedAt: now };
  if (step.type !== "WAIT") return { status: "ACTIVE" as const, currentStepId: step.id, nextRunAt: now, completedAt: null };
  const config = typeof step.config === "object" && step.config && !Array.isArray(step.config) ? step.config : {};
  const minutes = Number((config as Record<string, unknown>).durationMinutes);
  return { status: "WAITING" as const, currentStepId: step.id, nextRunAt: new Date(now.getTime() + minutes * 60_000), completedAt: null };
}

function nextStep(steps: { id: string; position: number; name: string; type: string; config: Prisma.JsonValue }[], position: number) {
  return steps.find((candidate) => candidate.position === position + 1);
}

function readTemplateMetadata(value: Prisma.JsonValue | null) {
  if (typeof value !== "object" || !value || Array.isArray(value)) return { mediaUuids: [], priceMinor: null };
  const metadata = value as Record<string, unknown>;
  const media = Array.isArray(metadata.media) ? metadata.media : [];
  return {
    mediaUuids: media.flatMap((item) => typeof item === "object" && item && "uuid" in item && typeof item.uuid === "string" ? [item.uuid] : []),
    priceMinor: typeof metadata.priceMinor === "number" ? metadata.priceMinor : null,
  };
}

function loadEnrollment(creatorId: string, enrollmentId: string) {
  return prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, creatorId },
    include: {
      fan: { select: { fanvueUserId: true, displayName: true, username: true } },
      currentStep: { include: { messageTemplate: true } },
      workflow: { include: { steps: { orderBy: { position: "asc" }, select: { id: true, position: true, name: true, type: true, config: true } } } },
    },
  });
}
