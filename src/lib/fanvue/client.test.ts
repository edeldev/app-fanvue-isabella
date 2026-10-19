import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("./config", () => ({ getFanvueConfig: () => ({ apiBaseUrl: "https://api.fanvue.test", apiVersion: "2025-06-26" }) }));

import { fanvueRequest } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("fanvueRequest", () => {
  it("treats unreadable JSON after a successful HTTP response as an invalid receipt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected end of JSON input")),
    }));
    await expect(fanvueRequest("/v1/chats/fan-1/message", "token", z.object({ messageUuid: z.string() }), { method: "POST" })).rejects.toMatchObject({
      status: 502,
      code: "FANVUE_INVALID_RESPONSE",
    });
  });

  it("treats a successful response with the wrong shape as an invalid receipt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) }));
    await expect(fanvueRequest("/v1/chats/fan-1/message", "token", z.object({ messageUuid: z.string() }), { method: "POST" })).rejects.toMatchObject({
      code: "FANVUE_INVALID_RESPONSE",
    });
  });
});
