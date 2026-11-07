import type { MediaSafety } from "@/domain/fans/content-consent";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";

export type MediaClassificationFailure =
  | "CONTENT_CLASSIFICATION_REQUIRED"
  | "FANVUE_NSFW_LABEL_REQUIRED"
  | "CONTENT_CLASSIFICATION_MISMATCH";

export class MediaClassificationError extends Error {
  constructor(readonly code: MediaClassificationFailure) {
    super(code);
    this.name = "MediaClassificationError";
  }
}

export async function assertFanvueMediaClassification(
  token: string,
  mediaUuids: string[],
  declaredSafety: MediaSafety,
) {
  if (!mediaUuids.length) return;
  if (declaredSafety === "UNREVIEWED") throw new MediaClassificationError("CONTENT_CLASSIFICATION_REQUIRED");

  const result = await fanvueRequest(
    `/v1/media/bulk?mediaUuids=${encodeURIComponent(mediaUuids.join(","))}`,
    token,
    mediaBulkSchema,
  );
  const media = mediaUuids.map((uuid) => result.results[uuid]);
  if (media.some((item) => !item || item.status !== "ready")) {
    throw new MediaClassificationError("CONTENT_CLASSIFICATION_REQUIRED");
  }

  const officialRatings = media.map((item) => item?.tags?.isNsfw);
  if (declaredSafety === "NSFW") {
    // Some valid Fanvue media responses omit `tags` entirely. Absence is not
    // proof that moderation rejected the asset. A creator declaring an asset
    // NSFW is also strictly safer than Fanvue reporting it as SFW, so it must
    // not be rejected as a mismatch. Consent and the conservative local
    // declaration are still enforced by assertSendRecipient.
    return;
  }

  if (officialRatings.some((rating) => rating === true)) {
    throw new MediaClassificationError("CONTENT_CLASSIFICATION_MISMATCH");
  }
}
