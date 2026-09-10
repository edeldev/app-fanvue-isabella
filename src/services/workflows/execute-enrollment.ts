import type { Prisma } from "@prisma/client";
import { renderTemplateVariables } from "@/domain/workflows/template-variables";
import { evaluateWorkflowConditionGroup, workflowConditionLabels, workflowConditions, type WorkflowCondition, type WorkflowConditionOperator, type WorkflowConditionRule } from "@/domain/workflows/evaluate-condition";
import { fanvueRequest } from "@/lib/fanvue/client";
import { sentMessageSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";
import { extendWorkflowPath } from "@/domain/workflows/transition-path";
import { isInsideSendWindow, nextSendWindowOpening } from "@/domain/workflows/send-window";
import { markWorkflowSendFailed, markWorkflowSendSucceeded, reserveWorkflowSend } from "./send-rate-limit";
import { maximumWorkflowAttempts, workflowRetryDecision } from "@/domain/workflows/retry-policy";

type LoadedEnrollment = NonNullable<Awaited<ReturnType<typeof loadEnrollment>>>;
type StepRecord = LoadedEnrollment["currentStep"];

export async function executeEnrollmentUntilBlocked(creatorId: string, enrollmentId: string) {
  const lockOwner = crypto.randomUUID();
  const now = new Date();
  const claimed = await prisma.workflowEnrollment.updateMany({
    where: {
      id: enrollmentId,
      creatorId,
      status: { in: ["ACTIVE", "WAITING"] },
      OR: [{ lockedAt: null }, { lockExpiresAt: { lt: now } }],
    },
    data: { lockedAt: now, lockOwner, lockExpiresAt: new Date(now.getTime() + 120_000) },
  });
  if (claimed.count !== 1) throw new Error("ENROLLMENT_BUSY");

  const outcomes: string[] = [];
  try {
    for (let index = 0; index < 50; index += 1) {
      const result = await executeEnrollmentStep(creatorId, enrollmentId, new Date());
      outcomes.push(result.outcome);
      if (!result.shouldContinue) return { outcomes, completed: result.outcome === "COMPLETED" };
    }
    throw new Error("WORKFLOW_STEP_LIMIT_REACHED");
  } finally {
    await prisma.workflowEnrollment.updateMany({
      where: { id: enrollmentId, creatorId, lockOwner },
      data: { lockedAt: null, lockOwner: null, lockExpiresAt: null },
    });
  }
}

async function executeEnrollmentStep(creatorId: string, enrollmentId: string, now = new Date()) {
  const enrollment = await loadEnrollment(creatorId, enrollmentId);
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");
  if (enrollment.status === "PAUSED") throw new Error("ENROLLMENT_PAUSED");
  if (!(["ACTIVE", "WAITING"] as const).includes(enrollment.status as "ACTIVE" | "WAITING")) throw new Error("ENROLLMENT_NOT_EXECUTABLE");
  if (!enrollment.currentStep) throw new Error("ENROLLMENT_STEP_NOT_FOUND");
  if (enrollment.nextRunAt && enrollment.nextRunAt > now) throw new Error(`ENROLLMENT_NOT_DUE:${enrollment.nextRunAt.toISOString()}`);

  const step = enrollment.currentStep;
  if (["SEND_OFFER"].includes(step.type)) {
    throw new Error(`STEP_NOT_IMPLEMENTED:${step.type}`);
  }

  if (step.type === "WAIT" && enrollment.status === "ACTIVE" && !enrollment.nextRunAt) {
    const schedule = scheduleWait(step, now);
    await prisma.$transaction([
      prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "WAITING", nextRunAt: schedule.nextRunAt } }),
      prisma.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, eventType: "WORKFLOW_WAIT_STARTED", explanation: `${step.name}: esperando hasta ${schedule.nextRunAt.toLocaleString("es-MX")}.` } }),
    ]);
    return { outcome: "WAIT_STARTED", nextStep: step.name, shouldContinue: false };
  }

  if ((step.type === "SEND_MESSAGE" || step.type === "SEND_PPV") && enrollment.workflow.sendWindowEnabled) {
    const configuredDays = Array.isArray(enrollment.workflow.sendWindowDays)
      ? enrollment.workflow.sendWindowDays.filter((day): day is number => typeof day === "number")
      : [];
    const window = {
      enabled: true,
      timeZone: enrollment.workflow.sendWindowTimezone,
      startMinute: enrollment.workflow.sendWindowStartMinute,
      endMinute: enrollment.workflow.sendWindowEndMinute,
      days: configuredDays,
    };
    if (!isInsideSendWindow(now, window)) {
      const nextRunAt = nextSendWindowOpening(now, window);
      await prisma.$transaction([
        prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "WAITING", nextRunAt, lastResult: { reasonCode: "OUTSIDE_SEND_WINDOW", nextRunAt: nextRunAt.toISOString() } } }),
        prisma.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, eventType: "WORKFLOW_SEND_WINDOW_DEFERRED", reasonCode: "OUTSIDE_SEND_WINDOW", explanation: `${step.name}: el mensaje se aplazó hasta ${nextRunAt.toLocaleString("es-MX", { timeZone: window.timeZone })} (${window.timeZone}).`, metadata: { nextRunAt: nextRunAt.toISOString(), timeZone: window.timeZone } } }),
      ]);
      return { outcome: "OUTSIDE_SEND_WINDOW", nextStep: step.name, shouldContinue: false };
    }
  }

  const idempotencyKey = `${enrollment.id}:${step.id}`;
  const previous = await prisma.automationExecution.findUnique({ where: { idempotencyKey } });
  if (previous?.status === "SUCCESS") throw new Error("STEP_ALREADY_EXECUTED");
  if (previous?.status === "RUNNING") throw new Error("STEP_ALREADY_RUNNING");
  if (previous?.status === "FAILED" && previous.attempt >= maximumWorkflowAttempts) {
    await prisma.$transaction([
      prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "FAILED", nextRunAt: null, lastResult: { reasonCode: "MAXIMUM_RETRIES_REACHED", stepId: step.id } } }),
      prisma.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, executionId: previous.id, eventType: "WORKFLOW_FAILED", level: "ERROR", reasonCode: "MAXIMUM_RETRIES_REACHED", explanation: `${step.name} agotó ${maximumWorkflowAttempts} intentos; el workflow fue detenido.` } }),
    ]);
    throw new Error("MAXIMUM_RETRIES_REACHED");
  }

  const execution = previous
    ? await prisma.automationExecution.update({ where: { id: previous.id }, data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: now, finishedAt: null, nextRetryAt: null, reason: null, reasonCode: null } })
    : await prisma.automationExecution.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, stepId: step.id, idempotencyKey, status: "RUNNING", startedAt: now } });

  try {
    if (step.type === "SEND_MESSAGE") {
      return await executeMessage(enrollment, step, execution.id, now);
    }
    if (step.type === "SEND_PPV") {
      return await executePpv(enrollment, step, execution.id, now);
    }
    if (step.type === "CHANGE_WORKFLOW") {
      return await executeWorkflowChange(enrollment, step, execution.id, now);
    }
    if (step.type === "CONDITION") {
      return await executeCondition(enrollment, step, execution.id, now);
    }
    return await finishLocalStep(enrollment, step, execution.id, now);
  } catch (error) {
    const decision = workflowRetryDecision(error, execution.attempt);
    const errorMessage = error instanceof Error ? error.message : "Error inesperado";
    if (decision.retryable && decision.delaySeconds !== null) {
      const retryAt = new Date(now.getTime() + decision.delaySeconds * 1_000);
      await prisma.$transaction([
        prisma.automationExecution.update({ where: { id: execution.id }, data: { status: "RETRYING", decision: "RETRY", reasonCode: decision.reasonCode, reason: errorMessage, finishedAt: new Date(), nextRetryAt: retryAt } }),
        prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "WAITING", nextRunAt: retryAt, lastResult: { reasonCode: decision.reasonCode, attempt: execution.attempt, retryAt: retryAt.toISOString() } } }),
        prisma.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, executionId: execution.id, eventType: "WORKFLOW_RETRY_SCHEDULED", level: "WARN", reasonCode: decision.reasonCode, explanation: `${step.name}: intento ${execution.attempt} falló temporalmente; se reintentará el ${retryAt.toLocaleString("es-MX")}.`, metadata: { error: errorMessage, attempt: execution.attempt, maximumAttempts: maximumWorkflowAttempts, retryAt: retryAt.toISOString() } } }),
      ]);
      return { outcome: "RETRY_SCHEDULED", nextStep: step.name, shouldContinue: false };
    }
    await prisma.$transaction([
      prisma.automationExecution.update({ where: { id: execution.id }, data: { status: "FAILED", decision: "CANCEL", reasonCode: decision.reasonCode, reason: errorMessage, finishedAt: new Date(), nextRetryAt: null } }),
      prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "FAILED", nextRunAt: null, lastResult: { reasonCode: decision.reasonCode, attempt: execution.attempt, error: errorMessage } } }),
      prisma.automationLog.create({ data: { creatorId, fanId: enrollment.fanId, enrollmentId, executionId: execution.id, eventType: "WORKFLOW_STEP_FAILED", level: "ERROR", reasonCode: decision.reasonCode, explanation: decision.reasonCode === "MAXIMUM_RETRIES_REACHED" ? `${step.name} agotó ${maximumWorkflowAttempts} intentos; el workflow fue detenido.` : `${step.name} encontró un error que no es seguro reintentar; el workflow fue detenido.`, metadata: { error: errorMessage, attempt: execution.attempt } } }),
    ]);
    throw error;
  }
}

async function executeCondition(enrollment: LoadedEnrollment, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  const config = jsonRecord(step.config);
  const legacyCondition = String(config.condition) as WorkflowCondition;
  const rules: WorkflowConditionRule[] = Array.isArray(config.conditions)
    ? config.conditions.flatMap((value) => {
      if (typeof value !== "object" || !value || Array.isArray(value)) return [];
      const rule = value as Record<string, unknown>;
      const condition = String(rule.condition) as WorkflowCondition;
      if (!workflowConditions.includes(condition)) return [];
      return [{ condition, ...(typeof rule.amountMinor === "number" ? { amountMinor: rule.amountMinor } : {}) }];
    })
    : [{ condition: legacyCondition }];
  const operator: WorkflowConditionOperator = config.conditionOperator === "ANY" ? "ANY" : "ALL";
  const fanFacts = {
    isFollower: enrollment.fan.isFollower,
    isSubscriber: enrollment.fan.isSubscriber,
    isFreeTrialSubscriber: enrollment.fan.isFreeTrialSubscriber,
    isAutoRenewingSubscriber: enrollment.fan.isAutoRenewingSubscriber,
    isNonRenewingSubscriber: enrollment.fan.isNonRenewingSubscriber,
    isExpiredSubscriber: enrollment.fan.isExpiredSubscriber,
    isCreatorAccount: enrollment.fan.isCreatorAccount,
    isMuted: enrollment.fan.isMuted,
    isOnline: enrollment.fan.isOnline,
    isTopSpender: enrollment.fan.isTopSpender,
    totalSpentMinor: enrollment.fan.totalSpentMinor,
    paidPurchasesCount: enrollment.fan._count.purchases,
  };
  const matched = evaluateWorkflowConditionGroup(operator, rules, fanFacts);
  const targetKey = String(matched ? config.trueTargetKey : config.falseTargetKey);
  const target = enrollment.workflow.steps.find((candidate) => jsonRecord(candidate.config).stepKey === targetKey);
  if (!target || target.position <= step.position) throw new Error("WORKFLOW_CONDITION_TARGET_INVALID");
  const schedule = scheduleNext(target, now);
  const conditionLabel = rules.map((rule) => {
    if (rule.condition === "SPENT_MORE_THAN_50" && typeof rule.amountMinor === "number") return `ha gastado más de $${(rule.amountMinor / 100).toFixed(2)}`;
    if (rule.condition === "SPENT_LESS_THAN" && typeof rule.amountMinor === "number") return `ha gastado menos de $${(rule.amountMinor / 100).toFixed(2)}`;
    return workflowConditionLabels[rule.condition].toLocaleLowerCase("es-MX");
  }).join(operator === "ALL" ? " Y " : " O ");
  await prisma.$transaction([
    prisma.automationExecution.update({ where: { id: executionId }, data: { status: "SUCCESS", decision: matched ? "SEND" : "SKIP", reason: matched ? "La regla se cumple." : "La regla no se cumple.", evidence: { operator, rules, matched, targetStepId: target.id }, finishedAt: new Date() } }),
    prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { ...schedule, lastRunAt: now, lastResult: { stepId: step.id, operator, rules, matched, targetStepId: target.id } } }),
    prisma.automationLog.create({ data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: "WORKFLOW_CONDITION_EVALUATED", explanation: `${step.name}: ${conditionLabel} = ${matched ? "sí" : "no"}; continúa en ${target.name}.`, metadata: { operator, rules, matched, targetStepId: target.id } } }),
  ]);
  return { outcome: "CONDITION_EVALUATED", nextStep: target.name, shouldContinue: schedule.status === "ACTIVE" };
}

async function executeMessage(enrollment: NonNullable<Awaited<ReturnType<typeof loadEnrollment>>>, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  if (!step.messageTemplate || step.messageTemplate.status !== "ACTIVE") throw new Error("WORKFLOW_TEMPLATE_UNAVAILABLE");
  const metadata = readTemplateMetadata(step.messageTemplate.metadata);
  if (metadata.priceMinor) throw new Error("WORKFLOW_TEMPLATE_REQUIRES_PPV_STEP");
  const text = renderTemplateVariables(step.messageTemplate.text, enrollment.fan);
  if (!text && metadata.mediaUuids.length === 0) throw new Error("WORKFLOW_TEMPLATE_EMPTY");

  const reservation = await prepareWorkflowSend(enrollment, step, executionId, now);
  if (!reservation.allowed) return reservation.result;

  const token = await getValidFanvueAccessToken(enrollment.creatorId);
  let sent;
  try {
    sent = await fanvueRequest(`/v1/chats/${enrollment.fan.fanvueUserId}/message`, token, sentMessageSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || null, mediaUuids: metadata.mediaUuids, mediaPreviewUuid: null, price: null }),
    });
  } catch (error) {
    if (reservation.reservationId) await markWorkflowSendFailed(reservation.reservationId);
    throw error;
  }
  const conversation = await prisma.conversation.upsert({
    where: { creatorId_fanId: { creatorId: enrollment.creatorId, fanId: enrollment.fanId } },
    update: { lastMessageAt: now, lastOutboundAt: now },
    create: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, lastMessageAt: now, lastOutboundAt: now },
  });
  const next = nextStep(enrollment.workflow.steps, step);
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
  if (reservation.reservationId) await markWorkflowSendSucceeded(reservation.reservationId, now);
  return { outcome: "MESSAGE_SENT", nextStep: next?.name ?? null, shouldContinue: schedule.status === "ACTIVE" };
}

async function executePpv(enrollment: LoadedEnrollment, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  if (!step.messageTemplate || step.messageTemplate.status !== "ACTIVE") throw new Error("WORKFLOW_TEMPLATE_UNAVAILABLE");
  const metadata = readTemplateMetadata(step.messageTemplate.metadata);
  if (!metadata.priceMinor || metadata.priceMinor < 300) throw new Error("WORKFLOW_PPV_PRICE_INVALID");
  if (!metadata.previewUuid || !metadata.mediaUuids.includes(metadata.previewUuid)) throw new Error("WORKFLOW_PPV_PREVIEW_REQUIRED");
  const lockedMediaUuids = metadata.mediaUuids.filter((uuid) => uuid !== metadata.previewUuid);
  if (!lockedMediaUuids.length) throw new Error("WORKFLOW_PPV_LOCKED_MEDIA_REQUIRED");
  const text = renderTemplateVariables(step.messageTemplate.text, enrollment.fan);
  const reservation = await prepareWorkflowSend(enrollment, step, executionId, now);
  if (!reservation.allowed) return reservation.result;
  const token = await getValidFanvueAccessToken(enrollment.creatorId);
  let sent;
  try {
    sent = await fanvueRequest(`/v1/chats/${enrollment.fan.fanvueUserId}/message`, token, sentMessageSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || null, mediaUuids: lockedMediaUuids, mediaPreviewUuid: metadata.previewUuid, price: metadata.priceMinor }),
    });
  } catch (error) {
    if (reservation.reservationId) await markWorkflowSendFailed(reservation.reservationId);
    throw error;
  }
  const conversation = await prisma.conversation.upsert({
    where: { creatorId_fanId: { creatorId: enrollment.creatorId, fanId: enrollment.fanId } },
    update: { lastMessageAt: now, lastOutboundAt: now },
    create: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, lastMessageAt: now, lastOutboundAt: now },
  });
  const next = nextStep(enrollment.workflow.steps, step);
  const schedule = scheduleNext(next, now);
  await prisma.$transaction([
    prisma.message.upsert({
      where: { creatorId_fanvueMessageId: { creatorId: enrollment.creatorId, fanvueMessageId: sent.messageUuid } },
      update: { text, templateId: step.messageTemplate.id, status: "SENT", mediaUuids: metadata.mediaUuids, mediaPreviewUuid: metadata.previewUuid, priceMinor: metadata.priceMinor },
      create: { creatorId: enrollment.creatorId, conversationId: conversation.id, fanvueMessageId: sent.messageUuid, templateId: step.messageTemplate.id, direction: "OUTBOUND", status: "SENT", text, mediaUuids: metadata.mediaUuids, mediaPreviewUuid: metadata.previewUuid, priceMinor: metadata.priceMinor, sentAt: now },
    }),
    prisma.automationExecution.update({ where: { id: executionId }, data: { status: "SUCCESS", decision: "SEND", reason: `PPV ${sent.messageUuid} enviado.`, evidence: { fanvueMessageId: sent.messageUuid, priceMinor: metadata.priceMinor, previewUuid: metadata.previewUuid }, finishedAt: new Date() } }),
    prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { ...schedule, lastRunAt: now, lastResult: { stepId: step.id, fanvueMessageId: sent.messageUuid, priceMinor: metadata.priceMinor } } }),
    prisma.automationLog.create({ data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: "WORKFLOW_PPV_SENT", explanation: `${step.name}: PPV de $${(metadata.priceMinor / 100).toFixed(2)} enviado a ${enrollment.fan.displayName || enrollment.fan.username || "fan"}.`, metadata: { templateId: step.messageTemplate.id, fanvueMessageId: sent.messageUuid, priceMinor: metadata.priceMinor } } }),
  ]);
  if (reservation.reservationId) await markWorkflowSendSucceeded(reservation.reservationId, now);
  return { outcome: "PPV_SENT", nextStep: next?.name ?? null, shouldContinue: schedule.status === "ACTIVE" };
}

async function executeWorkflowChange(enrollment: LoadedEnrollment, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  const targetWorkflowId = jsonRecord(step.config).targetWorkflowId;
  if (typeof targetWorkflowId !== "string") throw new Error("WORKFLOW_CHANGE_TARGET_REQUIRED");
  const target = await prisma.workflow.findFirst({
    where: { id: targetWorkflowId, creatorId: enrollment.creatorId, status: "PUBLISHED", isPrimary: true },
    include: { steps: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!target || !target.steps[0]) throw new Error("WORKFLOW_CHANGE_TARGET_UNAVAILABLE");
  const workflowPath = extendWorkflowPath(enrollment.workflowPath, enrollment.workflowId, target.id);
  const nextEnrollment = await prisma.$transaction(async (transaction) => {
    await transaction.automationExecution.update({
      where: { id: executionId },
      data: { status: "SUCCESS", decision: "CHANGE_WORKFLOW", reason: `Transferido a ${target.name}.`, evidence: { fromWorkflowId: enrollment.workflowId, toWorkflowId: target.id, workflowPath }, finishedAt: new Date() },
    });
    await transaction.workflowEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", currentStepId: null, nextRunAt: null, completedAt: now, lastRunAt: now, lastResult: { changedToWorkflowId: target.id } },
    });
    const created = await transaction.workflowEnrollment.create({
      data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, workflowId: target.id, currentStepId: target.steps[0].id, status: "ACTIVE", isPrimary: true, workflowPath },
    });
    await transaction.automationLog.create({
      data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: "WORKFLOW_CHANGED", explanation: `${enrollment.workflow.name} finalizó y cambió automáticamente a ${target.name}.`, metadata: { fromWorkflowId: enrollment.workflowId, toWorkflowId: target.id, nextEnrollmentId: created.id, workflowPath } },
    });
    return created;
  });
  try {
    await executeEnrollmentUntilBlocked(enrollment.creatorId, nextEnrollment.id);
    return { outcome: "WORKFLOW_CHANGED", nextStep: target.steps[0].name, shouldContinue: false };
  } catch {
    return { outcome: "WORKFLOW_CHANGED_RETRY_SCHEDULED", nextStep: target.steps[0].name, shouldContinue: false };
  }
}

async function finishLocalStep(enrollment: NonNullable<Awaited<ReturnType<typeof loadEnrollment>>>, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  const next = nextStep(enrollment.workflow.steps, step);
  const schedule = scheduleNext(next, now);
  const completed = step.type === "END";
  await prisma.$transaction([
    prisma.automationExecution.update({ where: { id: executionId }, data: { status: "SUCCESS", decision: completed ? "CANCEL" : "WAIT", reason: completed ? "Workflow finalizado." : "Espera cumplida.", finishedAt: new Date() } }),
    prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: completed ? { status: "COMPLETED", currentStepId: null, nextRunAt: null, completedAt: now, lastRunAt: now } : { ...schedule, lastRunAt: now } }),
    prisma.automationLog.create({ data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: completed ? "WORKFLOW_COMPLETED" : "WORKFLOW_WAIT_COMPLETED", explanation: completed ? `${enrollment.workflow.name} finalizó correctamente.` : `${step.name}: la espera terminó; continúa en ${next?.name || "el final"}.` } }),
  ]);
  return { outcome: completed ? "COMPLETED" : "WAIT_COMPLETED", nextStep: next?.name ?? null, shouldContinue: !completed && schedule.status === "ACTIVE" };
}

function scheduleNext(step: { id: string; type: string; config: Prisma.JsonValue } | undefined, now: Date) {
  if (!step) return { status: "COMPLETED" as const, currentStepId: null, nextRunAt: null, completedAt: now };
  if (step.type !== "WAIT") return { status: "ACTIVE" as const, currentStepId: step.id, nextRunAt: now, completedAt: null };
  return { status: "WAITING" as const, currentStepId: step.id, nextRunAt: scheduleWait(step, now).nextRunAt, completedAt: null };
}

function scheduleWait(step: { config: Prisma.JsonValue }, now: Date) {
  const minutes = Number(jsonRecord(step.config).durationMinutes);
  return { nextRunAt: new Date(now.getTime() + minutes * 60_000) };
}

async function prepareWorkflowSend(enrollment: LoadedEnrollment, step: NonNullable<StepRecord>, executionId: string, now: Date) {
  if (!enrollment.workflow.sendLimitsEnabled) return { allowed: true as const, reservationId: "" };
  const reservation = await reserveWorkflowSend({
    creatorId: enrollment.creatorId,
    workflowId: enrollment.workflowId,
    fanId: enrollment.fanId,
    enrollmentId: enrollment.id,
    stepId: step.id,
    maxPerHour: enrollment.workflow.maxMessagesPerHour,
    maxPerDay: enrollment.workflow.maxMessagesPerDay,
    minFanIntervalMinutes: enrollment.workflow.minMinutesBetweenFanMessages,
    now,
  });
  if (reservation.allowed) return reservation;
  const reason = reservation.reasonCode === "HOURLY_SEND_LIMIT" ? "se alcanzó el máximo por hora" : reservation.reasonCode === "DAILY_SEND_LIMIT" ? "se alcanzó el máximo de 24 horas" : "todavía no transcurre el intervalo mínimo para este fan";
  await prisma.$transaction([
    prisma.automationExecution.update({ where: { id: executionId }, data: { status: "SKIPPED", decision: "WAIT", reasonCode: reservation.reasonCode, reason, finishedAt: now, nextRetryAt: reservation.nextRunAt } }),
    prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "WAITING", nextRunAt: reservation.nextRunAt, lastResult: { reasonCode: reservation.reasonCode, nextRunAt: reservation.nextRunAt.toISOString() } } }),
    prisma.automationLog.create({ data: { creatorId: enrollment.creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, executionId, eventType: "WORKFLOW_SEND_LIMIT_DEFERRED", reasonCode: reservation.reasonCode, explanation: `${step.name}: ${reason}; se intentará nuevamente el ${reservation.nextRunAt.toLocaleString("es-MX")}.`, metadata: { nextRunAt: reservation.nextRunAt.toISOString(), workflowId: enrollment.workflowId } } }),
  ]);
  return { allowed: false as const, result: { outcome: reservation.reasonCode, nextStep: step.name, shouldContinue: false } };
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nextStep(steps: { id: string; position: number; name: string; type: string; config: Prisma.JsonValue }[], step: { position: number; config: Prisma.JsonValue }) {
  const targetKey = jsonRecord(step.config).nextTargetKey;
  if (typeof targetKey === "string") return steps.find((candidate) => jsonRecord(candidate.config).stepKey === targetKey);
  return steps.find((candidate) => candidate.position === step.position + 1);
}

function readTemplateMetadata(value: Prisma.JsonValue | null) {
  if (typeof value !== "object" || !value || Array.isArray(value)) return { mediaUuids: [], priceMinor: null, previewUuid: null };
  const metadata = value as Record<string, unknown>;
  const media = Array.isArray(metadata.media) ? metadata.media : [];
  return {
    mediaUuids: media.flatMap((item) => typeof item === "object" && item && "uuid" in item && typeof item.uuid === "string" ? [item.uuid] : []),
    priceMinor: typeof metadata.priceMinor === "number" ? metadata.priceMinor : null,
    previewUuid: typeof metadata.previewUuid === "string" ? metadata.previewUuid : null,
  };
}

function loadEnrollment(creatorId: string, enrollmentId: string) {
  return prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, creatorId },
    include: {
      fan: { select: { fanvueUserId: true, displayName: true, username: true, isFollower: true, isSubscriber: true, isFreeTrialSubscriber: true, isAutoRenewingSubscriber: true, isNonRenewingSubscriber: true, isExpiredSubscriber: true, isCreatorAccount: true, isMuted: true, isOnline: true, isTopSpender: true, totalSpentMinor: true, _count: { select: { purchases: { where: { reversedAt: null, amountMinor: { gt: 0 } } } } } } },
      currentStep: { include: { messageTemplate: true } },
      workflow: { include: { steps: { orderBy: { position: "asc" }, select: { id: true, position: true, name: true, type: true, config: true } } } },
    },
  });
}
