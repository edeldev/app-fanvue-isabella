import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert } = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("@/lib/session/creator-session", () => ({ CREATOR_SESSION_COOKIE: "creator_session", readCreatorSession: () => "creator-1" }));
vi.mock("@/lib/prisma", () => ({ prisma: { settings: { findUnique, upsert } } }));

import { GET, POST } from "./route";
import { MEDIA_RIGHTS_VERSION } from "@/lib/media-rights";

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
  upsert.mockResolvedValue({});
});

describe("media rights acknowledgement", () => {
  it("shows the notice until this version has been accepted", async () => {
    expect(await (await GET()).json()).toEqual({ accepted: false });
    findUnique.mockResolvedValue({ mediaRightsAcceptedAt: new Date(), mediaRightsVersion: MEDIA_RIGHTS_VERSION });
    expect(await (await GET()).json()).toEqual({ accepted: true });
  });

  it("does not record a partial or cross-origin acknowledgement", async () => {
    const partial = new Request("https://app.example/api/media/rights", { method: "POST", headers: { origin: "https://app.example" }, body: JSON.stringify({ rightsConfirmed: true, peopleConfirmed: true }) });
    expect((await POST(partial)).status).toBe(400);
    const crossOrigin = new Request("https://app.example/api/media/rights", { method: "POST", headers: { origin: "https://other.example" }, body: JSON.stringify({ rightsConfirmed: true, peopleConfirmed: true, termsConfirmed: true }) });
    expect((await POST(crossOrigin)).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("records the creator and policy version once all confirmations are given", async () => {
    const request = new Request("https://app.example/api/media/rights", { method: "POST", headers: { origin: "https://app.example" }, body: JSON.stringify({ rightsConfirmed: true, peopleConfirmed: true, termsConfirmed: true }) });
    expect((await POST(request)).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { creatorId: "creator-1" },
      update: expect.objectContaining({ mediaRightsVersion: MEDIA_RIGHTS_VERSION, mediaRightsAcceptedAt: expect.any(Date) }),
    }));
  });
});
