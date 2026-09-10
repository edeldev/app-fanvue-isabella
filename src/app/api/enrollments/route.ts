import { cookies } from "next/headers";
import { z } from "zod";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { startEnrollment, transitionEnrollment } from "@/services/workflows/manage-enrollment";
import { audienceSegments, buildAudienceWhere } from "@/domain/workflows/audience";
import { prisma } from "@/lib/prisma";
import { executeEnrollmentUntilBlocked } from "@/services/workflows/execute-enrollment";
import { reentryBlockedReason } from "@/domain/workflows/reentry-policy";

const inputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("fan"), fanId: z.string().min(1), workflowId: z.string().min(1) }),
  z.object({ mode: z.literal("preview"), include: z.array(z.enum(audienceSegments)).min(1), exclude: z.array(z.enum(audienceSegments)).default([]), excludedFanIds: z.array(z.string().min(1)).max(500).default([]), workflowId: z.string().min(1) }),
  z.object({ mode: z.literal("audience"), include: z.array(z.enum(audienceSegments)).min(1), exclude: z.array(z.enum(audienceSegments)).default([]), excludedFanIds: z.array(z.string().min(1)).max(500).default([]), workflowId: z.string().min(1) }),
  z.object({ mode: z.literal("start"), enrollmentIds: z.array(z.string().min(1)).min(1).max(2_000) }),
  z.object({ mode: z.literal("cancel_unstarted"), enrollmentIds: z.array(z.string().min(1)).min(1).max(2_000) }),
]);

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Selecciona un destino y un workflow." }, { status: 400 });
  try {
    if (input.data.mode === "preview") {
      const [workflow, fans] = await Promise.all([
        prisma.workflow.findFirst({ where: { id: input.data.workflowId, creatorId, status: "PUBLISHED", isPrimary: true }, select: { id: true, reentryPolicy: true, reentryDelayDays: true } }),
        prisma.fan.findMany({
          where: { ...buildAudienceWhere(creatorId, input.data.include, input.data.exclude), ...(input.data.excludedFanIds.length ? { id: { notIn: input.data.excludedFanIds } } : {}) },
          select: { id: true },
          take: 2_000,
        }),
      ]);
      if (!workflow) throw new Error("ENROLLMENT_WORKFLOW_NOT_FOUND");
      const fanIds = fans.map((fan) => fan.id);
      const [existing, prior] = await Promise.all([
        prisma.workflowEnrollment.findMany({
          where: { creatorId, workflowId: workflow.id, fanId: { in: fanIds }, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
          select: { fanId: true, lastRunAt: true, nextRunAt: true, pausedAt: true, _count: { select: { executions: true } } },
        }),
        prisma.workflowEnrollment.findMany({
          where: { creatorId, workflowId: workflow.id, fanId: { in: fanIds } },
          orderBy: { createdAt: "desc" },
          distinct: ["fanId"],
          select: { fanId: true, createdAt: true, completedAt: true, cancelledAt: true, updatedAt: true },
        }),
      ]);
      const existingFanIds = new Set(existing.map((item) => item.fanId));
      const priorByFan = new Map(prior.map((item) => [item.fanId, item]));
      const alreadyReady = existing.filter((item) => !item.lastRunAt && !item.nextRunAt && !item.pausedAt && item._count.executions === 0).length;
      const newAssignments = fans.filter((fan) => {
        if (existingFanIds.has(fan.id)) return false;
        const previous = priorByFan.get(fan.id);
        const reference = previous ? previous.completedAt ?? previous.cancelledAt ?? previous.updatedAt ?? previous.createdAt : null;
        return !reentryBlockedReason(workflow.reentryPolicy, reference ? { reentryReferenceAt: reference } : null, workflow.reentryDelayDays, new Date());
      }).length;
      const alreadyActive = existing.length - alreadyReady;
      return Response.json({ preview: { matched: fans.length, newAssignments, alreadyReady, alreadyActive, skipped: fans.length - newAssignments - alreadyReady - alreadyActive, limited: fans.length === 2_000 } });
    }
    if (input.data.mode === "fan") {
      const enrollment = await startEnrollment(creatorId, input.data.fanId, input.data.workflowId);
      return Response.json({ enrollment }, { status: 201 });
    }
    if (input.data.mode === "start" || input.data.mode === "cancel_unstarted") {
      const enrollments = await prisma.workflowEnrollment.findMany({
        where: { id: { in: input.data.enrollmentIds }, creatorId, status: "ACTIVE", lastRunAt: null, nextRunAt: null, pausedAt: null, executions: { none: {} } },
        select: { id: true },
      });
      if (input.data.mode === "cancel_unstarted") {
        for (let index = 0; index < enrollments.length; index += 10) {
          await Promise.all(enrollments.slice(index, index + 10).map((enrollment) => transitionEnrollment(creatorId, enrollment.id, "cancel", "Asignación masiva cancelada antes de iniciar.")));
        }
        return Response.json({ cancellation: { requested: input.data.enrollmentIds.length, cancelled: enrollments.length } });
      }
      let started = 0;
      let failed = 0;
      for (let index = 0; index < enrollments.length; index += 5) {
        await Promise.all(enrollments.slice(index, index + 5).map(async (enrollment) => {
          try {
            await executeEnrollmentUntilBlocked(creatorId, enrollment.id);
            started += 1;
          } catch {
            failed += 1;
          }
        }));
      }
      return Response.json({ start: { requested: input.data.enrollmentIds.length, started, failed } });
    }
    const workflowId = input.data.workflowId;
    const fans = await prisma.fan.findMany({
      where: {
        ...buildAudienceWhere(creatorId, input.data.include, input.data.exclude),
        ...(input.data.excludedFanIds.length ? { id: { notIn: input.data.excludedFanIds } } : {}),
      },
      select: { id: true },
      take: 2_000,
    });
    let assigned = 0;
    let unchanged = 0;
    const enrollmentIds: string[] = [];
    for (let index = 0; index < fans.length; index += 5) {
      await Promise.all(fans.slice(index, index + 5).map(async (fan) => {
        try {
          const enrollment = await startEnrollment(creatorId, fan.id, workflowId);
          assigned += 1;
          enrollmentIds.push(enrollment.id);
        } catch (error) {
          if (error instanceof Error && ["ENROLLMENT_ALREADY_ACTIVE", "WORKFLOW_REENTRY_ONCE", "WORKFLOW_REENTRY_COOLDOWN"].includes(error.message)) {
            const existing = await prisma.workflowEnrollment.findFirst({
              where: { creatorId, fanId: fan.id, workflowId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
              select: { id: true, lastRunAt: true, nextRunAt: true, pausedAt: true, _count: { select: { executions: true } } },
            });
            const hasNotStarted = existing && !existing.lastRunAt && !existing.nextRunAt && !existing.pausedAt && existing._count.executions === 0;
            if (error.message === "ENROLLMENT_ALREADY_ACTIVE" && hasNotStarted) {
              enrollmentIds.push(existing.id);
            } else unchanged += 1;
          } else throw error;
        }
      }));
    }
    return Response.json({ audience: { matched: fans.length, assigned, ready: enrollmentIds.length, unchanged, enrollmentIds } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar el workflow.";
    return Response.json({ error: message }, { status: message.includes("NOT_FOUND") ? 404 : 409 });
  }
}
