import { cookies } from "next/headers";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
import {
  consumeRateLimit,
  rateLimitedResponse,
  rateLimitPolicies,
} from "@/lib/rate-limit";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

export const runtime = "nodejs";

const inputSchema = z.object({
  mediaUuid: z.string().uuid(),
  intensity: z.enum(["coqueto", "atrevido", "explicito"]).default("atrevido"),
  objective: z.enum(["engagement", "subscription", "ppv"]).default("engagement"),
});
const outputSchema = z.object({
  caption: z.string().trim().min(1).max(2_000),
  visualSummary: z.string().trim().min(1).max(400),
  tone: z.string().trim().min(1).max(80),
});
const geminiSchema = {
  type: "object",
  properties: {
    caption: { type: "string" },
    visualSummary: { type: "string" },
    tone: { type: "string" },
  },
  required: ["caption", "visualSummary", "tone"],
};
type InteractionResponse = {
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function readInteractionText(body: InteractionResponse) {
  return body.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text || "")
    .join("")
    .trim();
}

export async function POST(request: Request) {
  const creatorId = readCreatorSession(
    (await cookies()).get(CREATOR_SESSION_COOKIE)?.value,
  );
  if (!creatorId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.aiPostCaption);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY no está configurada." }, { status: 503 });

  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const resolved = await fanvueRequest(
      `/v1/media/bulk?mediaUuids=${encodeURIComponent(input.data.mediaUuid)}&variants=main,thumbnail`,
      token,
      mediaBulkSchema,
    );
    const item = Object.values(resolved.results)[0];
    if (!item || item.status !== "ready" || item.mediaType !== "image") {
      return Response.json({ error: "Selecciona una imagen lista para analizar." }, { status: 422 });
    }
    const variant = item.variants.find((value) => value.variantType === "main" && value.url)
      ?? item.variants.find((value) => value.url);
    if (!variant?.url) return Response.json({ error: "La imagen no tiene una vista analizable." }, { status: 422 });

    const imageResponse = await fetch(variant.url, { signal: AbortSignal.timeout(12_000) });
    if (!imageResponse.ok) throw new Error("IMAGE_DOWNLOAD_FAILED");
    const bytes = await imageResponse.arrayBuffer();
    if (bytes.byteLength > 15 * 1024 * 1024) {
      return Response.json({ error: "La imagen es demasiado grande para analizarla." }, { status: 413 });
    }
    const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model,
        store: false,
        system_instruction: `Eres copywriter de una creadora adulta en Fanvue. Analiza únicamente lo visible en la imagen y crea un caption en español listo para publicar. Todas las personas representadas deben ser adultas; si existe cualquier duda sobre la edad, evita sexualizar y usa un texto coqueto no explícito. El nivel solicitado es ${input.data.intensity}. En nivel coqueto crea intriga; en atrevido usa deseo y provocación directa; en explícito puedes usar lenguaje sexual adulto, consentido y sensual, sin violencia ni degradación. Debe sonar personal, seguro y magnético, nunca genérico, desesperado ni como IA. Usa 1 a 3 emojis naturales. No inventes lugares, acciones pasadas ni prendas que no aparezcan. Objetivo: ${input.data.objective === "ppv" ? "despertar curiosidad para desbloquear PPV sin revelar todo" : input.data.objective === "subscription" ? "crear deseo de suscribirse sin presionar" : "provocar respuestas y conversación"}. Devuelve un resumen visual privado y un solo caption.`,
        input: [
          { type: "image", data: Buffer.from(bytes).toString("base64"), mime_type: mimeType },
          { type: "text", text: "Analiza esta imagen y escribe el caption solicitado." },
        ],
        generation_config: { temperature: 0.95 },
        response_format: { type: "text", mime_type: "application/json", schema: geminiSchema },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      return Response.json(
        { error: body?.error?.message || "Gemini no pudo analizar la imagen." },
        { status: response.status === 429 ? 429 : 502 },
      );
    }
    const raw = readInteractionText(await response.json() as InteractionResponse);
    if (!raw) return Response.json({ error: "Gemini no generó un caption." }, { status: 502 });
    const output = outputSchema.safeParse(JSON.parse(raw));
    if (!output.success) return Response.json({ error: "Gemini devolvió un resultado inesperado." }, { status: 502 });
    return Response.json({ suggestion: output.data });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "El análisis tardó demasiado. Intenta nuevamente."
      : "No se pudo analizar la imagen en este momento.";
    return Response.json({ error: message }, { status: 502 });
  }
}

