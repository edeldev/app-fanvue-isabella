import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { parseServerEnv } from "@/config/env";
import { verifyFanvueWebhookSignature } from "@/lib/fanvue/webhook-signature";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { handleFanvueWebhook } from "@/services/fanvue/webhook-handler";

type WebhookEnvelope = {
  id?: string;
  type: string;
  timestamp?: string;
  data?: unknown;
};

function parseEnvelope(rawBody: string): { envelope: WebhookEnvelope; payload: Prisma.InputJsonValue } | null {
  try {
    const payload = JSON.parse(rawBody) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const envelope = payload as WebhookEnvelope;
    if (typeof envelope.type !== "string" || !envelope.type.startsWith("creator.")) return null;
    return { envelope, payload: payload as Prisma.InputJsonValue };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const env = parseServerEnv();
  if (!verifyFanvueWebhookSignature(rawBody, request.headers.get("x-fanvue-signature"), env.FANVUE_WEBHOOK_SIGNING_SECRET)) {
    logger.error("Fanvue webhook signature rejected");
    return NextResponse.json({ error: "Firma no válida" }, { status: 401 });
  }

  const parsed = parseEnvelope(rawBody);
  if (!parsed) return NextResponse.json({ error: "Evento no válido" }, { status: 400 });

  const credential = await prisma.integrationCredential.findFirst({
    where: { provider: "FANVUE" },
    select: { creatorId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!credential) return NextResponse.json({ error: "Fanvue no está conectado" }, { status: 409 });

  const providerEventId = parsed.envelope.id ?? createHash("sha256").update(rawBody).digest("hex");
  const existing = await prisma.webhookEvent.findUnique({
    where: { creatorId_providerEventId: { creatorId: credential.creatorId, providerEventId } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  let event: { id: string };
  try {
    event = await prisma.webhookEvent.create({
      data: {
        creatorId: credential.creatorId,
        providerEventId,
        type: parsed.envelope.type,
        signatureVerified: true,
        payload: parsed.payload,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  after(async () => {
    try {
      await handleFanvueWebhook(credential.creatorId, parsed.envelope.type, parsed.envelope.data);
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), failedAt: null, failureReason: null } });
      logger.info("Fanvue webhook processed", { eventId: event.id, eventType: parsed.envelope.type });
    } catch (caught) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { failedAt: new Date(), failureReason: caught instanceof Error ? caught.name : "UnknownError" },
      });
      logger.error("Fanvue webhook processing failed", { eventId: event.id, eventType: parsed.envelope.type, errorName: caught instanceof Error ? caught.name : "UnknownError" });
    }
  });

  return NextResponse.json({ received: true }, { status: 202 });
}
