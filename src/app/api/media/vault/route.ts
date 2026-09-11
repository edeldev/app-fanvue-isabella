import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fanvueRequest } from "@/lib/fanvue/client";
import { FanvueError } from "@/lib/fanvue/errors";
import { vaultMediaPageSchema } from "@/lib/fanvue/sync-schemas";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

export async function GET(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const input = new URL(request.url).searchParams;
  const query = input.get("q")?.trim().slice(0, 80) ?? "";
  const cursor = input.get("cursor")?.slice(0, 500) ?? "";
  const mediaType = input.get("type");
  if (mediaType && mediaType !== "image" && mediaType !== "video") return NextResponse.json({ error: "Tipo de archivo inválido" }, { status: 400 });

  const params = new URLSearchParams({ size: "24", variants: "thumbnail,main", status: "ready" });
  if (query) params.set("name", query);
  if (cursor) params.set("cursor", cursor);
  if (mediaType) params.set("mediaType", mediaType);

  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const result = await fanvueRequest(`/v1/media?${params}` as `/v1/${string}`, token, vaultMediaPageSchema);
    const media = result.data.flatMap((item) => {
      if (item.status !== "ready" || (item.mediaType !== "image" && item.mediaType !== "video")) return [];
      const thumbnail = item.variants.find((value) => value.variantType === "thumbnail" && value.url)
        ?? item.variants.find((value) => value.variantType === "thumbnail_gallery" && value.url);
      const main = item.variants.find((value) => value.variantType === "main" && value.url)
        ?? item.variants.find((value) => value.url);
      return [{ uuid: item.uuid, name: item.name || `Archivo ${item.uuid.slice(0, 8)}`, mediaType: item.mediaType, localUrl: main?.url ?? thumbnail?.url, thumbnailUrl: thumbnail?.url, createdAt: item.createdAt ?? null }];
    });
    return NextResponse.json({ media, nextCursor: result.nextCursor });
  } catch (error) {
    const status = error instanceof FanvueError && error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: status === 429 ? "Fanvue limitó temporalmente la consulta. Intenta nuevamente en unos segundos." : "No se pudo abrir la bóveda de Fanvue." }, { status });
  }
}
