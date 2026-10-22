import { describe, expect, it } from "vitest";
import { hasAcceptedMediaRights, MEDIA_RIGHTS_VERSION } from "./media-rights";

describe("media upload rights acknowledgement", () => {
  it("requires an acknowledgement for this version", () => {
    expect(hasAcceptedMediaRights(null)).toBe(false);
    expect(hasAcceptedMediaRights({ mediaRightsAcceptedAt: null, mediaRightsVersion: MEDIA_RIGHTS_VERSION })).toBe(false);
    expect(hasAcceptedMediaRights({ mediaRightsAcceptedAt: new Date(), mediaRightsVersion: "older-version" })).toBe(false);
    expect(hasAcceptedMediaRights({ mediaRightsAcceptedAt: new Date(), mediaRightsVersion: MEDIA_RIGHTS_VERSION })).toBe(true);
  });
});
