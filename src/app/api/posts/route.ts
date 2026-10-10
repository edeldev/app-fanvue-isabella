import { cookies } from "next/headers";
import { z } from "zod";
import { buildPostMediaPayload } from "@/domain/posts/media-payload";
import { fanvueRequest } from "@/lib/fanvue/client";
import { FanvueError } from "@/lib/fanvue/errors";
import {
  fanvuePostSchema,
  fanvuePostsPageSchema,
  postAudienceSchema,
} from "@/lib/fanvue/post-schemas";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
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
    const mediaUuids = [...new Set(posts.data.flatMap((post) => [
      ...(post.mediaPreviewUuid ? [post.mediaPreviewUuid] : []),
      ...post.mediaUuids,
    ]))];
    const resolvedMedia = new Map<string, {
      uuid: string;
      name: string;
      mediaType: "image" | "video";
      url: string;
      thumbnailUrl: string;
    }>();

    for (let index = 0; index < mediaUuids.length; index += 20) {
      const chunk = mediaUuids.slice(index, index + 20);
      try {
        const resolved = await fanvueRequest(
          `/v1/media/bulk?mediaUuids=${encodeURIComponent(chunk.join(","))}&variants=main,thumbnail`,
          token,
          mediaBulkSchema,
        );
        for (const item of Object.values(resolved.results)) {
          if (!item || item.status !== "ready" || (item.mediaType !== "image" && item.mediaType !== "video")) continue;
          const main = item.variants.find((variant) => variant.variantType === "main" && variant.url)
            ?? item.variants.find((variant) => variant.url);
          const thumbnail = item.variants.find((variant) => variant.variantType === "thumbnail" && variant.url)
            ?? item.variants.find((variant) => variant.variantType === "thumbnail_gallery" && variant.url)
            ?? main;
          if (!main?.url && !thumbnail?.url) continue;
          resolvedMedia.set(item.uuid, {
            uuid: item.uuid,
            name: item.name || `Contenido ${item.mediaType === "video" ? "de video" : "visual"}`,
            mediaType: item.mediaType,
            url: main?.url ?? thumbnail?.url ?? "",
            thumbnailUrl: thumbnail?.url ?? main?.url ?? "",
          });
        }
      } catch {
        // El post sigue siendo útil aunque Fanvue no pueda firmar una miniatura temporal.
      }
    }

    return Response.json({
      ...posts,
      data: posts.data.map((post) => {
        const orderedUuids = [...new Set([
          ...(post.mediaPreviewUuid ? [post.mediaPreviewUuid] : []),
          ...post.mediaUuids,
        ])];
        return {
          ...post,
          media: orderedUuids.flatMap((uuid) => {
            const media = resolvedMedia.get(uuid);
            return media ? [{ ...media, isPreview: uuid === post.mediaPreviewUuid }] : [];
          }),
        };
      }),
    });
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
  const postMedia = buildPostMediaPayload(mediaUuids, price, mediaPreviewUuid);
  if (price && postMedia.mediaUuids.length === 0) {
    return Response.json({ error: "Un post PPV necesita contenido bloqueado además de la vista gratuita." }, { status: 400 });
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
        mediaUuids: postMedia.mediaUuids.length ? postMedia.mediaUuids : undefined,
        mediaPreviewUuid: postMedia.mediaPreviewUuid,
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

