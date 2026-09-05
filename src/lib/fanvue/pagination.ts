import type { z } from "zod";
import { fanvueRequest } from "./client";

const MAX_PAGES_PER_SYNC = 200;

export async function fetchAllCursorPages<T>(
  path: `/v1/${string}`,
  accessToken: string,
  schema: z.ZodType<{ data: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES_PER_SYNC; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const requestPath = `${path}${separator}size=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}` as `/v1/${string}`;
    const response = await fanvueRequest(requestPath, accessToken, schema);
    items.push(...response.data);
    cursor = response.nextCursor;
    if (!cursor) return items;
  }
  throw new Error("FANVUE_SYNC_PAGE_LIMIT_EXCEEDED");
}

