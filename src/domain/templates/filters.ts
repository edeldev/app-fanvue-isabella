export type TemplateKindFilter = "ALL" | "TEXT" | "MEDIA" | "IMAGE" | "VIDEO" | "MEDIA_ONLY" | "PPV";

export function matchesTemplateKind(template: { text: string; priceMinor: number | null; media: Array<{ mediaType: string }> }, kind: TemplateKindFilter) {
  const hasMedia = template.media.length > 0;
  if (kind === "ALL") return true;
  if (kind === "TEXT") return !hasMedia;
  if (kind === "MEDIA") return hasMedia;
  if (kind === "IMAGE") return template.media.some((item) => item.mediaType === "image");
  if (kind === "VIDEO") return template.media.some((item) => item.mediaType === "video");
  if (kind === "MEDIA_ONLY") return hasMedia && !template.text.trim();
  return Boolean(template.priceMinor);
}
