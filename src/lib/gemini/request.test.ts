import { afterEach, describe, expect, it, vi } from "vitest";
import { requestGeminiInteraction } from "./request";

afterEach(() => vi.unstubAllGlobals());

describe("requestGeminiInteraction", () => {
  it("retries one temporary server failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await requestGeminiInteraction({ apiKey: "key", body: { input: "hello" }, timeoutMs: 100, retryTimeoutMs: 100 });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry quota or validation failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await requestGeminiInteraction({ apiKey: "key", body: {}, timeoutMs: 100, retryTimeoutMs: 100 });
    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
