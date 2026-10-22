import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("./config", () => ({ getFanvueConfig: () => ({ apiBaseUrl: "https://api.fanvue.test", apiVersion: "2025-06-26" }) }));

import { fanvueRequest } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("fanvueRequest", () => {
  it.each([
    [{ message: "ContactabilityError: this user is not subscribed", privateDetail: "secret" }, "FANVUE_RECIPIENT_UNAVAILABLE"],
    [{ errors: [{ code: "MessageValidationError", message: "Invalid media ownership: secret" }] }, "FANVUE_MESSAGE_REJECTED"],
    [{ errors: ["InvalidUuidError: unknown recipient"] }, "FANVUE_INVALID_RECIPIENT_ID"],
  ])("classifies a rejected send without storing provider details", async (body, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: () => Promise.resolve(body),
    }));
    const error = await fanvueRequest("/v1/chats/fan-1/message", "token", z.object({ messageUuid: z.string() }), { method: "POST" }).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 400, code });
    expect(String(error)).not.toContain("secret");
  });

  it("keeps an unknown 400 non-retryable and does not expose its body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, headers: new Headers(), json: () => Promise.resolve({ message: "private text" }) }));
    const error = await fanvueRequest("/v1/chats/fan-1/message", "token", z.object({ messageUuid: z.string() }), { method: "POST" }).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 400, code: "FANVUE_API_ERROR" });
    expect(String(error)).not.toContain("private text");
  });

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
