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
    throw new FanvueError(
      `Fanvue request failed with status ${response.status}`,
      response.status,
      response.status === 429 ? "FANVUE_RATE_LIMIT" : "FANVUE_API_ERROR",
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

