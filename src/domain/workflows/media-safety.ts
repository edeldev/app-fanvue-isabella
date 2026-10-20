import type { MediaSafety } from "@/domain/fans/content-consent";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function workflowMediaUuids(value: unknown): string[] {
  const media = record(value).media;
  return Array.isArray(media) ? media.flatMap((item) => {
    const uuid = record(item).uuid;
    return typeof uuid === "string" ? [uuid] : [];
  }) : [];
}

export function publishedTemplateSfwMedia(value: unknown): string[] | null {
  const metadata = record(value);
  const uuids = workflowMediaUuids(metadata);
  return metadata.sfwAttested === true && metadata.priceMinor == null && uuids.length > 0 ? uuids : null;
}

export function workflowMessageMediaSafety(input: {
  stepType: string;
  config: unknown;
  templateMetadata?: unknown;
  mediaUuids: string[];
}): MediaSafety {
  if (input.stepType !== "SEND_MESSAGE" || input.mediaUuids.length === 0) return "UNREVIEWED";
  const config = record(input.config);
  if (input.templateMetadata !== undefined) {
    const published = config.publishedSfwMediaUuids;
    const current = publishedTemplateSfwMedia(input.templateMetadata);
    return Array.isArray(published) && current !== null && published.length === current.length &&
      published.every((uuid, index) => uuid === current[index] && uuid === input.mediaUuids[index]) ? "SFW" : "UNREVIEWED";
  }
  return config.manualSfwAttested === true ? "SFW" : "UNREVIEWED";
}
