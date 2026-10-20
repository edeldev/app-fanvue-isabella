import { preparePostText, type MediaOrigin } from "@/domain/posts/ai-media-disclosure";

export function prepareOutboundMediaText(text: string, mediaOrigin: MediaOrigin | null | undefined, mediaCount: number, aiProfileLabelConfirmed: boolean) {
  if (mediaCount === 0 || aiProfileLabelConfirmed) return text.trim();
  if (!mediaOrigin) throw new Error("MEDIA_ORIGIN_REQUIRED");
  return preparePostText(text, mediaOrigin ?? undefined, true);
}
