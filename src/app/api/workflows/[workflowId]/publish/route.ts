import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { templateContentRating } from "@/domain/workflows/media-safety";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";
import { replaceWorkflowTarget } from "@/domain/workflows/revision";

export async function POST(_request: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.workflowMutation);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  const workflow = await prisma.workflow.findFirst({
    where: { id: (await params).workflowId, creatorId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!workflow) return Response.json({ error: "Flujo no encontrado." }, { status: 404 });
  if (workflow.status !== "DRAFT") return Response.json({ error: "El flujo ya fue publicado." }, { status: 409 });
  if (!workflow.steps.length || workflow.steps.at(-1)?.type !== "END") {
    return Response.json({ error: "El flujo debe terminar con el paso Finalizar." }, { status: 400 });
  }
  const templateIds = [...new Set(workflow.steps.flatMap((step) => step.messageTemplateId ? [step.messageTemplateId] : []))];
  const templates = await prisma.messageTemplate.findMany({
    where: { creatorId, id: { in: templateIds }, status: "ACTIVE" },
    select: { id: true, metadata: true },
  });
  if (templates.length !== templateIds.length) return Response.json({ error: "Una plantilla del flujo ya no está disponible." }, { status: 400 });
  const profileAiLabelConfirmed = (await prisma.settings.findUnique({ where: { creatorId }, select: { aiProfileLabelConfirmed: true } }))?.aiProfileLabelConfirmed === true;
  const metadataById = new Map(templates.map((template) => [template.id, template.metadata]));
  for (const step of workflow.steps) {
    const config = typeof step.config === "object" && step.config !== null && !Array.isArray(step.config) ? step.config as Record<string, unknown> : {};
    if (!step.messageTemplateId) {
      const manualMedia = Array.isArray(config.manualMedia) ? config.manualMedia : [];
      if (manualMedia.length > 0 && config.manualContentRating !== "SFW" && config.manualContentRating !== "NSFW") {
        return Response.json({ error: `Clasifica los archivos del paso “${step.name}” como SFW o 18+ / NSFW antes de publicar.` }, { status: 400 });
      }
      continue;
    }
    const rawMetadata = metadataById.get(step.messageTemplateId);
    const metadata = rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata) ? rawMetadata as Record<string, unknown> : {};
    if (!profileAiLabelConfirmed && Array.isArray(metadata.media) && metadata.media.length > 0 && metadata.mediaOrigin !== "original" && metadata.mediaOrigin !== "ai_generated") {
      return Response.json({ error: `La plantilla del paso “${step.name}” tiene archivos sin clasificar. Edítala antes de publicar.` }, { status: 400 });
    }
    if (Array.isArray(metadata.media) && metadata.media.length > 0 && templateContentRating(metadata) === "UNREVIEWED") {
      return Response.json({ error: `La plantilla del paso “${step.name}” no tiene clasificación SFW o 18+ / NSFW.` }, { status: 400 });
    }
  }
  const published = await prisma.$transaction(async (transaction) => {
    for (const step of workflow.steps) {
      if (!step.messageTemplateId) continue;
      const config = typeof step.config === "object" && step.config !== null && !Array.isArray(step.config) ? step.config as Record<string, unknown> : {};
      const rest = { ...config };
      delete rest.publishedSfwMediaUuids;
      delete rest.publishedContentRating;
      delete rest.publishedMediaOrigin;
      delete rest.publishedMediaUuids;
      const metadata = metadataById.get(step.messageTemplateId);
      const media = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "media" in metadata && Array.isArray(metadata.media) ? metadata.media : [];
      const mediaUuids = media.flatMap((item) => typeof item === "object" && item !== null && !Array.isArray(item) && "uuid" in item && typeof item.uuid === "string" ? [item.uuid] : []);
      const mediaOrigin = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "mediaOrigin" in metadata
        ? metadata.mediaOrigin
        : null;
      const contentRating = templateContentRating(metadata);
      await transaction.workflowStep.update({
        where: { id: step.id },
        data: { config: { ...rest, publishedMediaUuids: mediaUuids, ...(contentRating !== "UNREVIEWED" ? { publishedContentRating: contentRating } : {}), ...(mediaOrigin === "original" || mediaOrigin === "ai_generated" ? { publishedMediaOrigin: mediaOrigin } : {}) } as Prisma.InputJsonValue },
      });
    }
    const previousVersions = await transaction.workflow.findMany({
      where: { creatorId, stableKey: workflow.stableKey, status: "PUBLISHED", id: { not: workflow.id } },
      select: { id: true, name: true, version: true },
    });
    const previousIds = previousVersions.map((item) => item.id);
    if (previousIds.length) {
      const now = new Date();
      const activeEnrollments = await transaction.workflowEnrollment.findMany({
        where: { creatorId, workflowId: { in: previousIds }, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
        select: { id: true, fanId: true, workflowId: true },
      });
      for (const enrollment of activeEnrollments) {
        await transaction.workflowEnrollment.update({
          where: { id: enrollment.id },
          data: { status: "CANCELLED", cancelledAt: now, nextRunAt: null, pausedAt: null, pausedFromStatus: null, pausedRemainingSeconds: null, cancellationReason: `Cancelado al publicar ${workflow.name} v${workflow.version}.`, lockedAt: null, lockOwner: null, lockExpiresAt: null },
        });
        await transaction.automationLog.create({
          data: { creatorId, fanId: enrollment.fanId, enrollmentId: enrollment.id, eventType: "WORKFLOW_VERSION_REPLACED", explanation: `${workflow.name}: la ejecución fue cancelada porque el administrador publicó la versión ${workflow.version}.`, metadata: { previousWorkflowId: enrollment.workflowId, replacementWorkflowId: workflow.id, replacementVersion: workflow.version } },
        });
      }
      const transitionSteps = await transaction.workflowStep.findMany({
        where: { workflow: { creatorId, status: "PUBLISHED" }, type: "CHANGE_WORKFLOW" },
        select: { id: true, config: true },
      });
      for (const previousId of previousIds) {
        for (const step of transitionSteps) {
          const nextConfig = replaceWorkflowTarget(step.config, previousId, workflow.id);
          if (nextConfig) await transaction.workflowStep.update({ where: { id: step.id }, data: { config: nextConfig as Prisma.InputJsonValue } });
        }
      }
      await transaction.workflow.updateMany({ where: { id: { in: previousIds } }, data: { status: "ARCHIVED", isPrimary: false } });
    }
    return transaction.workflow.update({
      where: { id: workflow.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), isPrimary: true },
    });
  });
  return Response.json({ workflow: published });
}
