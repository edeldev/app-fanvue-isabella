import { prisma } from "@/lib/prisma";

interface ReservationInput {
  creatorId: string;
  workflowId: string;
  fanId: string;
  enrollmentId: string;
  stepId: string;
  maxPerHour: number;
  maxPerDay: number;
  minFanIntervalMinutes: number;
  now: Date;
}

type SendLimitReason = "HOURLY_SEND_LIMIT" | "DAILY_SEND_LIMIT" | "FAN_SEND_INTERVAL";

export type SendReservationResult =
  | { allowed: true; reservationId: string }
  | { allowed: false; reasonCode: SendLimitReason; nextRunAt: Date };

export async function reserveWorkflowSend(input: ReservationInput): Promise<SendReservationResult> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.creatorId}))`;
    const existing = await transaction.workflowSendReservation.findUnique({
      where: { enrollmentId_stepId: { enrollmentId: input.enrollmentId, stepId: input.stepId } },
    });
    if (existing && !existing.failedAt) return { allowed: true, reservationId: existing.id };

    const hourStart = new Date(input.now.getTime() - 60 * 60_000);
    const dayStart = new Date(input.now.getTime() - 24 * 60 * 60_000);
    const fanStart = new Date(input.now.getTime() - input.minFanIntervalMinutes * 60_000);
    const [hourCount, dayCount, oldestHour, oldestDay, lastFanSend] = await Promise.all([
      transaction.workflowSendReservation.count({ where: { workflowId: input.workflowId, failedAt: null, reservedAt: { gt: hourStart } } }),
      transaction.workflowSendReservation.count({ where: { workflowId: input.workflowId, failedAt: null, reservedAt: { gt: dayStart } } }),
      transaction.workflowSendReservation.findFirst({ where: { workflowId: input.workflowId, failedAt: null, reservedAt: { gt: hourStart } }, orderBy: { reservedAt: "asc" } }),
      transaction.workflowSendReservation.findFirst({ where: { workflowId: input.workflowId, failedAt: null, reservedAt: { gt: dayStart } }, orderBy: { reservedAt: "asc" } }),
      input.minFanIntervalMinutes > 0 ? transaction.workflowSendReservation.findFirst({ where: { creatorId: input.creatorId, fanId: input.fanId, failedAt: null, reservedAt: { gt: fanStart } }, orderBy: { reservedAt: "desc" } }) : null,
    ]);

    const blocks: Array<{ reasonCode: SendLimitReason; nextRunAt: Date }> = [];
    if (hourCount >= input.maxPerHour && oldestHour) blocks.push({ reasonCode: "HOURLY_SEND_LIMIT", nextRunAt: new Date(oldestHour.reservedAt.getTime() + 60 * 60_000 + 1_000) });
    if (dayCount >= input.maxPerDay && oldestDay) blocks.push({ reasonCode: "DAILY_SEND_LIMIT", nextRunAt: new Date(oldestDay.reservedAt.getTime() + 24 * 60 * 60_000 + 1_000) });
    if (lastFanSend) blocks.push({ reasonCode: "FAN_SEND_INTERVAL", nextRunAt: new Date(lastFanSend.reservedAt.getTime() + input.minFanIntervalMinutes * 60_000 + 1_000) });
    if (blocks.length) {
      const block = blocks.reduce((latest, candidate) => candidate.nextRunAt > latest.nextRunAt ? candidate : latest);
      return { allowed: false, ...block };
    }

    const reservation = await transaction.workflowSendReservation.upsert({
      where: { enrollmentId_stepId: { enrollmentId: input.enrollmentId, stepId: input.stepId } },
      update: { reservedAt: input.now, sentAt: null, failedAt: null },
      create: { creatorId: input.creatorId, workflowId: input.workflowId, fanId: input.fanId, enrollmentId: input.enrollmentId, stepId: input.stepId, reservedAt: input.now },
    });
    return { allowed: true, reservationId: reservation.id };
  });
}

export async function markWorkflowSendSucceeded(reservationId: string, sentAt = new Date()) {
  await prisma.workflowSendReservation.update({ where: { id: reservationId }, data: { sentAt, failedAt: null } });
}

export async function markWorkflowSendFailed(reservationId: string, failedAt = new Date()) {
  await prisma.workflowSendReservation.update({ where: { id: reservationId }, data: { failedAt } });
}
