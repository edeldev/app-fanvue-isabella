export type TemplateKindFilter = "ALL" | "TEXT" | "MEDIA" | "IMAGE" | "VIDEO" | "MEDIA_ONLY" | "PPV";

export function matchesTemplateKind(template: { text: string; priceMinor: number | null; media: Array<{ mediaType: string }> }, kind: TemplateKindFilter) {
  const hasMedia = template.media.length > 0;
  const isPpv = Boolean(template.priceMinor);
  if (kind === "ALL") return true;
  if (kind === "PPV") return isPpv;
  if (kind === "TEXT") return !hasMedia && !isPpv;
  if (kind === "MEDIA") return hasMedia && !isPpv;
  if (kind === "IMAGE") return !isPpv && template.media.some((item) => item.mediaType === "image");
  if (kind === "VIDEO") return !isPpv && template.media.some((item) => item.mediaType === "video");
  return hasMedia && !isPpv && !template.text.trim();
}
