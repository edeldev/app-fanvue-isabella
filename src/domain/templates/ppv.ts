export function hasLockedPpvMedia(
  media: Array<{ uuid: string }>,
  previewUuid: string | null,
) {
  return media.some((item) => item.uuid !== previewUuid);
}

