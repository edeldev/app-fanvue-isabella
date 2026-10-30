export function resolveMessagePreviewUuid({
  explicitPreviewUuid,
  messageMediaUuids,
  resolvedMediaUuids,
  priceMinor,
}: {
  explicitPreviewUuid: string | null;
  messageMediaUuids: string[];
  resolvedMediaUuids: string[];
  priceMinor: number | null;
}) {
  if (explicitPreviewUuid) return explicitPreviewUuid;
  if (priceMinor === null || messageMediaUuids.length === 0) return null;

  const locked = new Set(messageMediaUuids);
  const unattached = resolvedMediaUuids.filter((uuid) => !locked.has(uuid));
  return unattached.length === 1 && resolvedMediaUuids.length === locked.size + 1
    ? unattached[0]
    : null;
}
