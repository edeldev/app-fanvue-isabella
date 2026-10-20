import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishedTemplateSfwMedia } from "@/domain/workflows/media-safety";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { consumeRateLimit, rateLimitedResponse, rateLimitPolicies } from "@/lib/rate-limit";

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
  const metadataById = new Map(templates.map((template) => [template.id, template.metadata]));
  for (const step of workflow.steps) {
    if (!step.messageTemplateId) continue;
    const rawMetadata = metadataById.get(step.messageTemplateId);
    const metadata = rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata) ? rawMetadata as Record<string, unknown> : {};
    if (Array.isArray(metadata.media) && metadata.media.length > 0 && metadata.mediaOrigin !== "original" && metadata.mediaOrigin !== "ai_generated") {
      return Response.json({ error: `La plantilla del paso “${step.name}” tiene archivos sin clasificar. Edítala antes de publicar.` }, { status: 400 });
    }
  }
  const published = await prisma.$transaction(async (transaction) => {
    for (const step of workflow.steps) {
      if (!step.messageTemplateId) continue;
      const config = typeof step.config === "object" && step.config !== null && !Array.isArray(step.config) ? step.config as Record<string, unknown> : {};
      const rest = { ...config };
      delete rest.publishedSfwMediaUuids;
      delete rest.publishedMediaOrigin;
      delete rest.publishedMediaUuids;
      const sfwMedia = step.type === "SEND_MESSAGE" ? publishedTemplateSfwMedia(metadataById.get(step.messageTemplateId)) : null;
      const metadata = metadataById.get(step.messageTemplateId);
      const media = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "media" in metadata && Array.isArray(metadata.media) ? metadata.media : [];
      const mediaUuids = media.flatMap((item) => typeof item === "object" && item !== null && !Array.isArray(item) && "uuid" in item && typeof item.uuid === "string" ? [item.uuid] : []);
      const mediaOrigin = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "mediaOrigin" in metadata
        ? metadata.mediaOrigin
        : null;
      await transaction.workflowStep.update({
        where: { id: step.id },
        data: { config: { ...rest, publishedMediaUuids: mediaUuids, ...(sfwMedia ? { publishedSfwMediaUuids: sfwMedia } : {}), ...(mediaOrigin === "original" || mediaOrigin === "ai_generated" ? { publishedMediaOrigin: mediaOrigin } : {}) } as Prisma.InputJsonValue },
      });
    }
    return transaction.workflow.update({
      where: { id: workflow.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  });
  return Response.json({ workflow: published });
}
