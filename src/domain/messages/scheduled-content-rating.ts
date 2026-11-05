export function scheduledMediaIsNsfw(value: unknown) {
  return Array.isArray(value) && value.some((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    return (item as Record<string, unknown>).contentRating === "NSFW";
  });
}
