import type { z } from "zod";
import { getFanvueConfig } from "./config";
import { FanvueError } from "./errors";

export async function fanvueRequest<TSchema extends z.ZodType>(
  path: `/v1/${string}`,
  accessToken: string,
  schema: TSchema,
  init: RequestInit = {},
): Promise<z.infer<TSchema>> {
  const config = getFanvueConfig();
  const response = await fetch(new URL(path, config.apiBaseUrl), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Fanvue-API-Version": config.apiVersion,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    let providerError: unknown;
    if (response.status === 400) {
      try {
        providerError = await response.json();
      } catch {
        // Keep the HTTP status when Fanvue returns an unreadable error body.
      }
    }
    const category = response.status === 400 ? classifyFanvueBadRequest(providerError) : null;
    throw new FanvueError(
      `Fanvue request failed with status ${response.status}${category ? ` (${category.toLowerCase()})` : ""}`,
      response.status,
      response.status === 429 ? "FANVUE_RATE_LIMIT" : category ? `FANVUE_${category}` : "FANVUE_API_ERROR",
      retryAfter ? Number(retryAfter) : undefined,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // A successful HTTP status does not prove the caller received a usable
    // receipt. For sends, the delivery outcome must remain ambiguous.
    throw new FanvueError("Fanvue response validation failed", 502, "FANVUE_INVALID_RESPONSE");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new FanvueError("Fanvue response validation failed", 502, "FANVUE_INVALID_RESPONSE");
  return parsed.data;
}

// Fanvue's 400 payloads have several shapes. Only persist a fixed category;
// provider messages may contain fan identifiers or private message content.
function classifyFanvueBadRequest(body: unknown): "RECIPIENT_UNAVAILABLE" | "MESSAGE_REJECTED" | "INVALID_RECIPIENT_ID" | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const parts: string[] = [];
  for (const value of [record.code, record.error, record.message]) {
    if (typeof value === "string") parts.push(value.slice(0, 500));
  }
  if (Array.isArray(record.errors)) {
    for (const item of record.errors.slice(0, 5)) {
      if (typeof item === "string") parts.push(item.slice(0, 500));
      else if (item && typeof item === "object" && !Array.isArray(item)) {
        const error = item as Record<string, unknown>;
        for (const value of [error.code, error.message]) {
          if (typeof value === "string") parts.push(value.slice(0, 500));
        }
      }
    }
  }
  const detail = parts.join(" ").toLowerCase();
  if (/contactability|not contactable|cannot (?:be )?messag|can't (?:be )?messag|not allowed to (?:send|message)|not subscribed/.test(detail)) return "RECIPIENT_UNAVAILABLE";
  if (/invaliduuid|invalid uuid|invalid user uuid/.test(detail)) return "INVALID_RECIPIENT_ID";
  if (/messagevalidation|validation|invalid media|invalid price|invalid message|media ownership/.test(detail)) return "MESSAGE_REJECTED";
  return null;
}

