import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { mediaBulkSchema } from "@/lib/fanvue/sync-schemas";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const idsSchema = z.array(z.string().uuid()).min(1).max(20);

export async function GET(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const values = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  const ids = idsSchema.safeParse([...new Set(values)]);
  if (!ids.success) return NextResponse.json({ error: "Identificadores inválidos" }, { status: 400 });
  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const result = await fanvueRequest(`/v1/media/bulk?mediaUuids=${encodeURIComponent(ids.data.join(","))}&variants=main,thumbnail`, token, mediaBulkSchema);
    const media = Object.values(result.results).flatMap(item => {
      if (!item || item.status !== "ready") return [];
      const main = item.variants.find(value => value.variantType === "main" && value.url)
        ?? item.variants.find(value => value.url);
      const thumbnail = item.variants.find(value => value.variantType === "thumbnail" && value.url)
        ?? item.variants.find(value => value.variantType === "thumbnail_gallery" && value.url);
      return main?.url || thumbnail?.url ? [{ uuid: item.uuid, url: main?.url ?? thumbnail?.url, thumbnailUrl: thumbnail?.url }] : [];
    });
    return NextResponse.json({ media });
  } catch {
    return NextResponse.json({ error: "No se pudieron recuperar las vistas previas." }, { status: 502 });
  }
}
