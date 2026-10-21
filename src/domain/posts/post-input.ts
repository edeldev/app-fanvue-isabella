import { z } from "zod";
import { postAudienceSchema } from "@/lib/fanvue/post-schemas";

export const createPostSchema = z.object({
  text: z.string().trim().max(5_000).default(""),
  mediaUuids: z.array(z.string().uuid()).max(10).default([]),
  mediaPreviewUuid: z.string().uuid().nullable().optional(),
  price: z.number().int().min(300).nullable().optional(),
  audience: postAudienceSchema,
  publishAt: z.string().datetime().nullable().optional(),
  mediaOrigin: z.enum(["original", "ai_generated"]).optional(),
});

const fieldErrors: Record<string, string> = {
  text: "El texto supera los 5000 caracteres.",
  mediaUuids: "Uno o más archivos no son válidos. Vuelve a agregarlos.",
  mediaPreviewUuid: "La vista previa no es válida. Vuelve a seleccionarla.",
  price: "El precio del PPV debe ser de al menos $3.00.",
  audience: "Selecciona una audiencia válida.",
  publishAt: "Selecciona una fecha y hora válidas.",
  mediaOrigin: "Confirma si el contenido visual es original o generado con IA.",
};

export function postInputError(error: z.ZodError) {
  const field = String(error.issues[0]?.path[0] ?? "");
  return fieldErrors[field] ?? "Revisa los datos de la publicación.";
}
