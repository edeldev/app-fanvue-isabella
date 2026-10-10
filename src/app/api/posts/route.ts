import { cookies } from "next/headers";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { FanvueError } from "@/lib/fanvue/errors";
import {
  fanvuePostSchema,
  fanvuePostsPageSchema,
  postAudienceSchema,
} from "@/lib/fanvue/post-schemas";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import {
  consumeRateLimit,
  rateLimitedResponse,
  rateLimitPolicies,
} from "@/lib/rate-limit";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const createPostSchema = z.object({
  text: z.string().trim().max(5_000).default(""),
  mediaUuids: z.array(z.string().uuid()).max(10).default([]),
  mediaPreviewUuid: z.string().uuid().nullable().optional(),
  price: z.number().int().min(300).nullable().optional(),
  audience: postAudienceSchema,
  publishAt: z.string().datetime().nullable().optional(),
});

function fanvueErrorResponse(error: unknown) {
  if (error instanceof FanvueError && error.status === 403) {
    return Response.json(
      { error: "Fanvue necesita el permiso write:post. Vuelve a conectar tu cuenta desde Configuración." },
      { status: 403 },
    );
  }
  if (error instanceof FanvueError && error.status === 429) {
    return Response.json(
      { error: "Fanvue limitó temporalmente las publicaciones. Intenta nuevamente en unos segundos." },
      { status: 429 },
    );
  }
  return Response.json(
    { error: "Fanvue no pudo procesar la publicación." },
    { status: 502 },
  );
}

export async function GET() {
  const creatorId = readCreatorSession(
    (await cookies()).get(CREATOR_SESSION_COOKIE)?.value,
  );
  if (!creatorId) return Response.json({ error: "No autorizado" }, { status: 401 });

  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const posts = await fanvueRequest(
      "/v1/posts?size=20&includeUnpublished=true",
      token,
      fanvuePostsPageSchema,
    );
    return Response.json(posts);
  } catch (error) {
    return fanvueErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const creatorId = readCreatorSession(
    (await cookies()).get(CREATOR_SESSION_COOKIE)?.value,
  );
  if (!creatorId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const rateLimit = await consumeRateLimit(creatorId, rateLimitPolicies.postCreate);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const input = createPostSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "Revisa el texto, precio, audiencia y archivos." }, { status: 400 });
  }
  const { text, mediaUuids, mediaPreviewUuid, price, audience, publishAt } = input.data;
  if (!text && mediaUuids.length === 0) {
    return Response.json({ error: "Agrega texto o contenido multimedia." }, { status: 400 });
  }
  if (price && mediaUuids.length === 0) {
    return Response.json({ error: "Un post PPV necesita al menos una foto o video." }, { status: 400 });
  }
  if (mediaPreviewUuid && !mediaUuids.includes(mediaPreviewUuid)) {
    return Response.json({ error: "La vista previa debe pertenecer al contenido seleccionado." }, { status: 400 });
  }
  if (publishAt && new Date(publishAt).getTime() < Date.now() + 30_000) {
    return Response.json({ error: "Programa el post al menos 30 segundos en el futuro." }, { status: 400 });
  }

  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const post = await fanvueRequest("/v1/posts", token, fanvuePostSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text || undefined,
        mediaUuids: mediaUuids.length ? mediaUuids : undefined,
        mediaPreviewUuid: price ? mediaPreviewUuid || undefined : undefined,
        price: price || undefined,
        audience,
        publishAt: publishAt || undefined,
      }),
    });
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return fanvueErrorResponse(error);
  }
}

