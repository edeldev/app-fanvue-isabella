import {
  maintenanceIsDue,
  operationalLogRetentionDays,
  retentionCutoff,
  webhookPayloadRetentionDays,
} from "@/domain/maintenance/retention";
import { workflowActivityEventTypes } from "@/domain/workflows/activity";
import { prisma } from "@/lib/prisma";
import { sanitizeErrorMessage } from "@/lib/logger";

const heartbeatId = "maintenance-cleanup";

export async function runScheduledCleanup(now = new Date()) {
  const previous = await prisma.schedulerHeartbeat.findUnique({ where: { id: heartbeatId }, select: { lastSucceededAt: true } });
  if (!maintenanceIsDue(previous?.lastSucceededAt ?? null, now)) return { ran: false, rateLimitBuckets: 0, webhookPayloads: 0, operationalLogs: 0 };

  await prisma.schedulerHeartbeat.upsert({
    where: { id: heartbeatId },
    create: { id: heartbeatId, status: "RUNNING", lastStartedAt: now },
    update: { status: "RUNNING", lastStartedAt: now, error: null },
  });

  try {
    const operationalCutoff = retentionCutoff(now, operationalLogRetentionDays);
    const webhookCutoff = retentionCutoff(now, webhookPayloadRetentionDays);
    const [rateLimitBuckets, webhookPayloads, operationalLogs] = await prisma.$transaction([
      prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.webhookEvent.deleteMany({ where: { processedAt: { not: null, lt: webhookCutoff } } }),
      prisma.automationLog.deleteMany({
        where: {
          occurredAt: { lt: operationalCutoff },
          enrollmentId: null,
          executionId: null,
          eventType: { notIn: [...workflowActivityEventTypes] },
        },
      }),
    ]);
    const result = { ran: true, rateLimitBuckets: rateLimitBuckets.count, webhookPayloads: webhookPayloads.count, operationalLogs: operationalLogs.count };
    await prisma.schedulerHeartbeat.update({ where: { id: heartbeatId }, data: { status: "SUCCESS", lastFinishedAt: new Date(), lastSucceededAt: new Date(), result, error: null } });
    return result;
  } catch (error) {
    await prisma.schedulerHeartbeat.update({ where: { id: heartbeatId }, data: { status: "FAILED", lastFinishedAt: new Date(), error: sanitizeErrorMessage(error instanceof Error ? error.message : "Error de limpieza desconocido").slice(0, 1_000) } }).catch(() => undefined);
    throw error;
  }
}
