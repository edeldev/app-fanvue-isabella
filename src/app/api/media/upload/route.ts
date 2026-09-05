import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fanvueRequest } from "@/lib/fanvue/client";
import { getFanvueConfig } from "@/lib/fanvue/config";
import { mediaUploadCompleteSchema, mediaUploadSessionSchema } from "@/lib/fanvue/sync-schemas";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";

const allowedTypes = new Map([["image/jpeg", "image"], ["image/png", "image"], ["image/webp", "image"], ["image/gif", "image"], ["video/mp4", "video"], ["video/quicktime", "video"], ["video/webm", "video"]]);
const MAX_FILE_SIZE = 250 * 1024 * 1024;

async function fanvueText(path: string, token: string) {
  const config = getFanvueConfig();
  const response = await fetch(new URL(path, config.apiBaseUrl), {
    headers: { Accept: "text/plain", Authorization: `Bearer ${token}`, "X-Fanvue-API-Version": config.apiVersion },
  });
  if (!response.ok) throw new Error(`Fanvue upload URL failed: ${response.status}`);
  return response.text();
}

async function uploadFile(file: File, token: string) {
  const mediaType = allowedTypes.get(file.type);
  if (!mediaType || file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error("INVALID_FILE");
  const session = await fanvueRequest("/v1/media/uploads", token, mediaUploadSessionSchema, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, filename: file.name, mediaType, sizeBytes: file.size }),
  });
  const totalParts = session.totalParts ?? Math.ceil(file.size / session.partSize);
  if (totalParts > session.maxParts) throw new Error("FILE_TOO_LARGE");
  const parts: Array<{ ETag?: string; PartNumber: number }> = [];
  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    const start = (partNumber - 1) * session.partSize;
    const chunk = file.slice(start, Math.min(start + session.partSize, file.size));
    const signedUrl = await fanvueText(`/v1/media/uploads/${encodeURIComponent(session.uploadId)}/parts/${partNumber}/url`, token);
    const uploaded = await fetch(signedUrl, { method: "PUT", body: chunk });
    if (!uploaded.ok) throw new Error(`MEDIA_PART_FAILED_${uploaded.status}`);
    const etag = uploaded.headers.get("etag");
    parts.push({ ...(etag ? { ETag: etag } : {}), PartNumber: partNumber });
  }
  await fanvueRequest(`/v1/media/uploads/${encodeURIComponent(session.uploadId)}`, token, mediaUploadCompleteSchema, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parts }),
  });
  let ready = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const state = await fanvueRequest(`/v1/media/${session.mediaUuid}`, token, z.object({ status: z.enum(["created", "processing", "ready", "error"]) }).passthrough());
    if (state.status === "ready") { ready = true; break; }
    if (state.status === "error") throw new Error("MEDIA_PROCESSING_FAILED");
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  if (!ready) throw new Error("MEDIA_PROCESSING_TIMEOUT");
  return { uuid: session.mediaUuid, name: file.name, mediaType };
}

export async function POST(request: Request) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length < 1 || files.length > 10) return NextResponse.json({ error: "Selecciona entre 1 y 10 archivos." }, { status: 400 });
  try {
    const token = await getValidFanvueAccessToken(creatorId);
    const media = [];
    for (const file of files) media.push(await uploadFile(file, token));
    return NextResponse.json({ media });
  } catch (caught) {
    const message = caught instanceof Error && caught.message === "INVALID_FILE" ? "Solo se permiten imágenes y videos de hasta 250 MB." : "Fanvue no pudo procesar los archivos.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
