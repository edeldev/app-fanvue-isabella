export const AI_MEDIA_DISCLOSURE = "Contenido visual generado o alterado con IA.";

export type MediaOrigin = "original" | "ai_generated";

export function preparePostText(text: string, mediaOrigin: MediaOrigin | undefined, hasMedia: boolean, bioDisclosureConfirmed = false) {
  if (hasMedia && !mediaOrigin) throw new Error("Confirma si las fotos o videos fueron generados o alterados con IA.");
  const trimmed = text.trim();
  if (mediaOrigin !== "ai_generated" || !hasMedia || bioDisclosureConfirmed) return trimmed;
  if (trimmed.includes(AI_MEDIA_DISCLOSURE)) return trimmed;
  return trimmed ? `${trimmed}\n\n${AI_MEDIA_DISCLOSURE}` : AI_MEDIA_DISCLOSURE;
}
