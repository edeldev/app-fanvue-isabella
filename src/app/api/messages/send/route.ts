import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { FanvueError } from "@/lib/fanvue/errors";
import { sentMessageSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";
import { consumeRateLimit, rateLimitPolicies } from "@/lib/rate-limit";
import { canReceivePaidOrIntimateContent, canReceiveMessageMedia } from "@/domain/fans/content-consent";
import { isAmbiguousManualSendFailure, sendIntentRedirectStatus } from "@/domain/messages/send-intent";
import { assertSendRecipient, SendRecipientIneligibleError } from "@/services/messages/assert-send-recipient";

const mediaSchema = z.array(z.object({ uuid: z.string().uuid(), name: z.string(), mediaType: z.enum(["image", "video"]) })).max(10);
const formSchema = z.object({ fanUuid: z.string().uuid(), sendIntentId: z.string().uuid(), text: z.string().trim().max(5000), templateId: z.string().optional(), price: z.string(), previewUuid: z.string().optional(), scheduledAt: z.string().datetime().optional() });
const audience = [{ isFollower: true }, { isSubscriber: true }, { isExpiredSubscriber: true }];
function parseJson(value: FormDataEntryValue | null) { try { return JSON.parse(String(value || "[]")) as unknown; } catch { return null; } }

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) redirect("/?fanvue=connection_required");
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.messageSend);
  if (!rateLimit.allowed) redirect(`/messages?error=rate_limited&retryAfter=${rateLimit.retryAfterSeconds}`);
  const form = await request.formData();
  const parsed = formSchema.safeParse({ fanUuid: form.get("fanUuid"), sendIntentId: form.get("sendIntentId"), text: form.get("text") || "", templateId: form.get("templateId") || undefined, price: String(form.get("price") || ""), previewUuid: form.get("previewUuid") || undefined, scheduledAt: form.get("scheduledAt") || undefined });
  if (!parsed.success) redirect("/messages?error=invalid_message");
  const media = mediaSchema.safeParse(parseJson(form.get("mediaJson")));
  if (!media.success || (!parsed.data.text && media.data.length === 0)) redirect("/messages?error=invalid_message");
  const price = parsed.data.price ? Math.round(Number(parsed.data.price) * 100) : null;
  if (price !== null && (!Number.isInteger(price) || price < 300 || media.data.length === 0)) redirect("/messages?error=invalid_price");
  const previewUuid = parsed.data.previewUuid && media.data.some(item => item.uuid === parsed.data.previewUuid) ? parsed.data.previewUuid : null;
  const effectivePreviewUuid = price ? previewUuid : null;
  const lockedMedia = effectivePreviewUuid
    ? media.data.filter((item) => item.uuid !== effectivePreviewUuid)
    : media.data;
  if (price !== null && lockedMedia.length === 0) {
    redirect("/messages?error=invalid_ppv_preview");
  }
  const fan = await prisma.fan.findFirst({
    where: { creatorId, fanvueUserId: parsed.data.fanUuid, isCreatorAccount: false, OR: audience },
  });
  if (!fan) redirect("/messages?error=invalid_recipient");
  if (fan.doNotMessage) redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=do_not_message`);
  if ((price !== null && !canReceivePaidOrIntimateContent(fan)) || !canReceiveMessageMedia(fan, media.data.length)) redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=explicit_opt_in_required`);
  const template = parsed.data.templateId ? await prisma.messageTemplate.findFirst({
    where: { id: parsed.data.templateId, creatorId, status: "ACTIVE" },
    select: { id: true },
  }) : null;
  if (parsed.data.templateId && !template) redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=invalid_template`);
  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : new Date();
  if (parsed.data.scheduledAt) {
    const now = new Date();
    if (scheduledAt.getTime() < now.getTime() + 30_000 || scheduledAt.getTime() > now.getTime() + 366 * 24 * 60 * 60_000) {
      redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=invalid_schedule`);
    }
  }
  try {
    await prisma.scheduledMessage.create({
      data: {
        id: parsed.data.sendIntentId,
        creatorId,
        fanId: fan.id,
        status: parsed.data.scheduledAt ? "PENDING" : "SENDING",
        templateId: template?.id,
        text: parsed.data.text || null,
        media: media.data,
        mediaPreviewUuid: effectivePreviewUuid,
        priceMinor: price,
        scheduledAt,
      },
    });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    const existing = await prisma.scheduledMessage.findUnique({ where: { id: parsed.data.sendIntentId }, select: { creatorId: true, fanId: true, status: true } });
    if (!existing || existing.creatorId !== creatorId || existing.fanId !== fan.id) redirect("/messages?error=invalid_message");
    const outcome = sendIntentRedirectStatus(existing.status);
    redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&${outcome === "sent" || outcome === "scheduled" ? `${outcome}=1` : `error=${outcome}`}`);
  }
  if (parsed.data.scheduledAt) {
    redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&scheduled=1`);
  }
  try {
    const token = await getValidFanvueAccessToken(creatorId);
    await assertSendRecipient(creatorId, fan.id, media.data.length, price !== null);
    const sent = await fanvueRequest(`/v1/chats/${fan.fanvueUserId}/message`, token, sentMessageSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: parsed.data.text || null,
        mediaUuids: lockedMedia.map(item => item.uuid),
        mediaPreviewUuid: effectivePreviewUuid,
        price,
      }),
    });
    await prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.upsert({
        where: { creatorId_fanId: { creatorId, fanId: fan.id } },
        update: { lastMessageAt: new Date(), lastOutboundAt: new Date() },
        create: { creatorId, fanId: fan.id, lastMessageAt: new Date(), lastOutboundAt: new Date() },
      });
      await transaction.message.upsert({
        where: { creatorId_fanvueMessageId: { creatorId, fanvueMessageId: sent.messageUuid } },
        update: { text: parsed.data.text, templateId: template?.id, status: "SENT", mediaUuids: media.data.map(item => item.uuid), mediaPreviewUuid: effectivePreviewUuid, priceMinor: price },
        create: { creatorId, conversationId: conversation.id, fanvueMessageId: sent.messageUuid, templateId: template?.id, direction: "OUTBOUND", status: "SENT", text: parsed.data.text, mediaUuids: media.data.map(item => item.uuid), mediaPreviewUuid: effectivePreviewUuid, priceMinor: price, sentAt: new Date() },
      });
      await transaction.scheduledMessage.update({ where: { id: parsed.data.sendIntentId }, data: { status: "SENT", sentAt: new Date(), fanvueMessageId: sent.messageUuid, lastError: null } });
    });
  } catch (error) {
    const ambiguous = !(error instanceof SendRecipientIneligibleError) && isAmbiguousManualSendFailure(error);
    await prisma.scheduledMessage.updateMany({
      where: { id: parsed.data.sendIntentId, creatorId, status: "SENDING" },
      data: { status: ambiguous ? "NEEDS_REVIEW" : error instanceof SendRecipientIneligibleError ? "BLOCKED" : "FAILED", lastError: ambiguous ? "DELIVERY_STATUS_UNKNOWN_CHECK_FANVUE" : error instanceof SendRecipientIneligibleError ? error.code : "FANVUE_REJECTED_SEND" },
    });
    if (error instanceof SendRecipientIneligibleError) {
      const notice = error.code === "FAN_DO_NOT_MESSAGE" ? "do_not_message" : error.code === "EXPLICIT_CONTENT_OPT_IN_REQUIRED" ? "explicit_opt_in_required" : "invalid_recipient";
      redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=${notice}`);
    }
    if (error instanceof FanvueError && error.status === 429) {
      const retryAfter = Number.isFinite(error.retryAfterSeconds) ? Math.max(1, Math.ceil(error.retryAfterSeconds ?? 60)) : 60;
      redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=rate_limited&retryAfter=${retryAfter}`);
    }
    redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=${ambiguous ? "send_review" : "send_failed"}`);
  }
  redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&sent=1`);
}
