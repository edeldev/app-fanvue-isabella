export function buildPostMediaPayload(
  mediaUuids: string[],
  price: number | null | undefined,
  mediaPreviewUuid: string | null | undefined,
) {
  const previewUuid = price && mediaPreviewUuid ? mediaPreviewUuid : undefined;
  return {
    mediaUuids: previewUuid
      ? mediaUuids.filter((uuid) => uuid !== previewUuid)
      : mediaUuids,
    mediaPreviewUuid: previewUuid,
  };
}

