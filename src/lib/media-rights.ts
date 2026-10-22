// Increment when the acknowledgement text materially changes.
export const MEDIA_RIGHTS_VERSION = "2026-10-22-v1";

export function hasAcceptedMediaRights(settings: { mediaRightsAcceptedAt: Date | null; mediaRightsVersion: string | null } | null): boolean {
  return Boolean(settings?.mediaRightsAcceptedAt && settings.mediaRightsVersion === MEDIA_RIGHTS_VERSION);
}
