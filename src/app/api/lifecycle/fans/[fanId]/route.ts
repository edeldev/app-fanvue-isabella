import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { lifecycleStages } from "@/domain/lifecycle/presentation";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { recalculateFanLifecycle } from "@/services/lifecycle/recalculate-fan-lifecycle";
import { refreshFanMemory } from "@/services/intelligence/refresh-fan-memory";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ADD_NOTE"), body: z.string().trim().min(1).max(2_000) }),
  z.object({ action: z.literal("DELETE_NOTE"), noteId: z.string().min(1) }),
  z.object({ action: z.literal("ADD_TAG"), name: z.string().trim().min(1).max(40), color: z.string().trim().max(30).optional() }),
  z.object({ action: z.literal("REMOVE_TAG"), tagId: z.string().min(1) }),
  z.object({ action: z.literal("SET_STAGE"), stage: z.enum(lifecycleStages as [typeof lifecycleStages[number], ...typeof lifecycleStages[number][]]).nullable() }),
  z.object({ action: z.literal("SET_AUTOMATION_PAUSE"), paused: z.boolean(), reason: z.string().trim().max(240).optional() }),
  z.object({ action: z.literal("CONFIRM_MEMORY"), memoryId: z.string().min(1) }),
  z.object({ action: z.literal("DISMISS_MEMORY"), memoryId: z.string().min(1) }),
  z.object({ action: z.literal("REFRESH_MEMORY") }),
]);

type RouteContext = { params: Promise<{ fanId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { fanId } = await params;
  const fan = await prisma.fan.findFirst({ where: { id: fanId, creatorId }, select: { id: true } });
  if (!fan) return NextResponse.json({ error: "Fan no encontrado" }, { status: 404 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  const data = parsed.data;

  if (data.action === "ADD_NOTE") {
    await prisma.fanNote.create({ data: { creatorId, fanId, body: data.body } });
  } else if (data.action === "DELETE_NOTE") {
    await prisma.fanNote.deleteMany({ where: { id: data.noteId, creatorId, fanId } });
  } else if (data.action === "ADD_TAG") {
    const tag = await prisma.tag.upsert({
      where: { creatorId_name: { creatorId, name: data.name } },
      update: { color: data.color || undefined },
      create: { creatorId, name: data.name, color: data.color || "violet" },
    });
    await prisma.fanTag.upsert({
      where: { fanId_tagId: { fanId, tagId: tag.id } },
      update: { source: "MANUAL" },
      create: { creatorId, fanId, tagId: tag.id, source: "MANUAL" },
    });
  } else if (data.action === "REMOVE_TAG") {
    await prisma.fanTag.deleteMany({ where: { creatorId, fanId, tagId: data.tagId } });
  } else if (data.action === "SET_STAGE") {
    await prisma.fan.update({ where: { id: fanId }, data: { lifecycleOverride: data.stage } });
    await recalculateFanLifecycle(creatorId, fanId, data.stage ? "MANUAL_OVERRIDE" : "MANUAL_OVERRIDE_REMOVED");
  } else if (data.action === "CONFIRM_MEMORY" || data.action === "DISMISS_MEMORY") {
    const now = new Date();
    const memory = await prisma.fanMemory.findFirst({
      where: { id: data.memoryId, creatorId, fanId },
      select: { id: true },
    });
    if (!memory) return NextResponse.json({ error: "Memoria no encontrada" }, { status: 404 });
    await prisma.$transaction([
      prisma.fanMemory.updateMany({
        where: { id: data.memoryId, creatorId, fanId },
        data: data.action === "CONFIRM_MEMORY"
          ? { type: "FACT", status: "ACTIVE", confirmedAt: now, dismissedAt: null }
          : { status: "DISMISSED", dismissedAt: now },
      }),
      prisma.fanEvent.create({
        data: {
          creatorId,
          fanId,
          type: data.action === "CONFIRM_MEMORY" ? "FAN_MEMORY_CONFIRMED" : "FAN_MEMORY_DISMISSED",
          occurredAt: now,
          payload: { memoryId: data.memoryId },
        },
      }),
    ]);
  } else if (data.action === "REFRESH_MEMORY") {
    await refreshFanMemory(creatorId, fanId);
  } else {
    const now = new Date();
    const reason = data.reason || "Pausado manualmente desde el perfil.";
    const enrollments = await prisma.workflowEnrollment.findMany({
      where: data.paused
        ? { creatorId, fanId, status: { in: ["ACTIVE", "WAITING"] } }
        : { creatorId, fanId, status: "PAUSED", pauseReason: "FAN_PROFILE_PAUSE" },
      select: { id: true, status: true, pausedFromStatus: true, pausedRemainingSeconds: true, nextRunAt: true },
    });
    await prisma.$transaction([
      prisma.fan.update({ where: { id: fanId }, data: { automationPaused: data.paused, automationPauseReason: data.paused ? reason : null } }),
      ...enrollments.map((enrollment) => prisma.workflowEnrollment.update({
        where: { id: enrollment.id },
        data: data.paused ? {
          status: "PAUSED",
          pausedAt: now,
          pausedFromStatus: enrollment.status,
          pausedRemainingSeconds: enrollment.nextRunAt ? Math.max(0, Math.ceil((enrollment.nextRunAt.getTime() - now.getTime()) / 1_000)) : null,
          pauseReason: "FAN_PROFILE_PAUSE",
          nextRunAt: null,
        } : {
          status: enrollment.pausedFromStatus === "WAITING" ? "WAITING" : "ACTIVE",
          nextRunAt: enrollment.pausedFromStatus === "WAITING" && enrollment.pausedRemainingSeconds !== null
            ? new Date(now.getTime() + enrollment.pausedRemainingSeconds * 1_000)
            : null,
          pausedAt: null,
          pausedFromStatus: null,
          pausedRemainingSeconds: null,
          pauseReason: null,
        },
      })),
      prisma.fanEvent.create({
      data: {
        creatorId,
        fanId,
        type: data.paused ? "FAN_AUTOMATION_PAUSED" : "FAN_AUTOMATION_RESUMED",
        occurredAt: now,
        payload: { reason: data.reason ?? null },
      },
      }),
    ]);
  }
  return NextResponse.json({ ok: true });
}
