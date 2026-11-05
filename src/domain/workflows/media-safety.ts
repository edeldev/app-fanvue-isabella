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

export function templateContentRating(value: unknown): MediaSafety {
  const metadata = record(value);
  if (metadata.contentRating === "SFW" || metadata.contentRating === "NSFW") return metadata.contentRating;
  return metadata.sfwAttested === true ? "SFW" : "UNREVIEWED";
}

export function publishedTemplateSfwMedia(value: unknown): string[] | null {
  const uuids = workflowMediaUuids(value);
  return templateContentRating(value) === "SFW" && uuids.length > 0 ? uuids : null;
}

export function workflowMessageMediaSafety(input: {
  stepType: string;
  config: unknown;
  templateMetadata?: unknown;
  mediaUuids: string[];
}): MediaSafety {
  if (!input.mediaUuids.length) return "UNREVIEWED";
  const config = record(input.config);
  if (input.templateMetadata !== undefined) {
    const published = config.publishedMediaUuids;
    const publishedRating = config.publishedContentRating;
    const currentRating = templateContentRating(input.templateMetadata);
    const unchanged = Array.isArray(published) && published.length === input.mediaUuids.length &&
      published.every((uuid, index) => uuid === input.mediaUuids[index]);
    if (unchanged && (publishedRating === "SFW" || publishedRating === "NSFW") && publishedRating === currentRating) return publishedRating;
    // Versions published before contentRating was introduced already froze
    // the exact media UUIDs. They may adopt a first classification, but any
    // later publication freezes both UUIDs and rating together.
    if (unchanged && publishedRating === undefined && currentRating !== "UNREVIEWED") return currentRating;
    const legacySfw = config.publishedSfwMediaUuids;
    if (currentRating === "SFW" && Array.isArray(legacySfw) && legacySfw.length === input.mediaUuids.length && legacySfw.every((uuid, index) => uuid === input.mediaUuids[index])) return "SFW";
    return "UNREVIEWED";
  }
  if (config.manualContentRating === "SFW" || config.manualContentRating === "NSFW") return config.manualContentRating;
  return input.stepType === "SEND_MESSAGE" && config.manualSfwAttested === true ? "SFW" : "UNREVIEWED";
}
