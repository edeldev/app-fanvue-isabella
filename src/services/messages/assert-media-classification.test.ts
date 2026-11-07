import { beforeEach, describe, expect, it, vi } from "vitest";

const { fanvueRequest } = vi.hoisted(() => ({ fanvueRequest: vi.fn() }));
vi.mock("@/lib/fanvue/client", () => ({ fanvueRequest }));

import { assertFanvueMediaClassification } from "./assert-media-classification";

describe("assertFanvueMediaClassification", () => {
  beforeEach(() => fanvueRequest.mockReset());

  it("blocks media without a creator classification", async () => {
    await expect(assertFanvueMediaClassification("token", ["media-1"], "UNREVIEWED")).rejects.toMatchObject({ code: "CONTENT_CLASSIFICATION_REQUIRED" });
    expect(fanvueRequest).not.toHaveBeenCalled();
  });

  it("allows declared NSFW media when Fanvue omits optional tag metadata", async () => {
    fanvueRequest.mockResolvedValue({ results: { "media-1": { uuid: "media-1", status: "ready", tags: null } }, errors: [] });
    await expect(assertFanvueMediaClassification("token", ["media-1"], "NSFW")).resolves.toBeUndefined();
  });

  it("allows officially tagged NSFW media and rejects NSFW hidden as SFW", async () => {
    fanvueRequest.mockResolvedValue({ results: { "media-1": { uuid: "media-1", status: "ready", tags: { isNsfw: true, nsfwCategory: ["nudity"] } } }, errors: [] });
    await expect(assertFanvueMediaClassification("token", ["media-1"], "NSFW")).resolves.toBeUndefined();
    await expect(assertFanvueMediaClassification("token", ["media-1"], "SFW")).rejects.toMatchObject({ code: "CONTENT_CLASSIFICATION_MISMATCH" });
  });

  it("allows a conservative local NSFW declaration when Fanvue reports SFW", async () => {
    fanvueRequest.mockResolvedValue({ results: { "media-1": { uuid: "media-1", status: "ready", tags: { isNsfw: false, nsfwCategory: [] } } }, errors: [] });
    await expect(assertFanvueMediaClassification("token", ["media-1"], "NSFW")).resolves.toBeUndefined();
  });
});
