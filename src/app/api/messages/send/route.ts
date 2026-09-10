import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { sentMessageSchema } from "@/lib/fanvue/sync-schemas";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";
import { consumeRateLimit, rateLimitPolicies } from "@/lib/rate-limit";

const mediaSchema = z.array(z.object({ uuid: z.string().uuid(), name: z.string(), mediaType: z.enum(["image", "video"]) })).max(10);
const formSchema = z.object({ fanUuid: z.string().uuid(), text: z.string().trim().max(5000), templateId: z.string().optional(), price: z.string(), previewUuid: z.string().optional() });
const audience = [{ isFollower: true }, { isSubscriber: true }, { isExpiredSubscriber: true }];
function parseJson(value: FormDataEntryValue | null) { try { return JSON.parse(String(value || "[]")) as unknown; } catch { return null; } }

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) redirect("/?fanvue=connection_required");
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.messageSend);
  if (!rateLimit.allowed) redirect(`/messages?error=rate_limited&retryAfter=${rateLimit.retryAfterSeconds}`);
  const form = await request.formData();
  const parsed = formSchema.safeParse({ fanUuid: form.get("fanUuid"), text: form.get("text") || "", templateId: form.get("templateId") || undefined, price: String(form.get("price") || ""), previewUuid: form.get("previewUuid") || undefined });
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
  const template = parsed.data.templateId ? await prisma.messageTemplate.findFirst({
    where: { id: parsed.data.templateId, creatorId, status: "ACTIVE" },
    select: { id: true },
  }) : null;
  if (parsed.data.templateId && !template) redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=invalid_template`);
  try {
    const token = await getValidFanvueAccessToken(creatorId);
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
    const conversation = await prisma.conversation.findUnique({ where: { creatorId_fanId: { creatorId, fanId: fan.id } } });
    if (conversation) await prisma.message.upsert({
      where: { creatorId_fanvueMessageId: { creatorId, fanvueMessageId: sent.messageUuid } },
      update: { text: parsed.data.text, templateId: template?.id, status: "SENT", mediaUuids: media.data.map(item => item.uuid), mediaPreviewUuid: effectivePreviewUuid, priceMinor: price },
      create: { creatorId, conversationId: conversation.id, fanvueMessageId: sent.messageUuid, templateId: template?.id, direction: "OUTBOUND", status: "SENT", text: parsed.data.text, mediaUuids: media.data.map(item => item.uuid), mediaPreviewUuid: effectivePreviewUuid, priceMinor: price, sentAt: new Date() },
    });
  } catch {
    redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&error=send_failed`);
  }
  redirect(`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}&sent=1`);
}
