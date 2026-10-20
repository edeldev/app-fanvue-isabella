import { describe, expect, it } from "vitest";
import { publishedTemplateSfwMedia, workflowMessageMediaSafety } from "./media-safety";

const template = { media: [{ uuid: "photo-a" }, { uuid: "photo-b" }], priceMinor: null, sfwAttested: true };

describe("workflowMessageMediaSafety", () => {
  it("keeps legacy published templates protected", () => {
    expect(workflowMessageMediaSafety({ stepType: "SEND_MESSAGE", config: {}, templateMetadata: template, mediaUuids: ["photo-a", "photo-b"] })).toBe("UNREVIEWED");
  });

  it("allows an attested free template only with the same published media", () => {
    const config = { publishedSfwMediaUuids: ["photo-a", "photo-b"] };
    expect(workflowMessageMediaSafety({ stepType: "SEND_MESSAGE", config, templateMetadata: template, mediaUuids: ["photo-a", "photo-b"] })).toBe("SFW");
    expect(workflowMessageMediaSafety({ stepType: "SEND_MESSAGE", config, templateMetadata: { ...template, media: [{ uuid: "photo-c" }] }, mediaUuids: ["photo-c"] })).toBe("UNREVIEWED");
    expect(workflowMessageMediaSafety({ stepType: "SEND_MESSAGE", config, templateMetadata: { ...template, sfwAttested: false }, mediaUuids: ["photo-a", "photo-b"] })).toBe("UNREVIEWED");
  });

  it("allows manual SFW messages but never PPV", () => {
    expect(workflowMessageMediaSafety({ stepType: "SEND_MESSAGE", config: { manualSfwAttested: true }, mediaUuids: ["photo-a"] })).toBe("SFW");
    expect(workflowMessageMediaSafety({ stepType: "SEND_PPV", config: { manualSfwAttested: true }, mediaUuids: ["photo-a"] })).toBe("UNREVIEWED");
  });

  it("does not mark paid templates or empty media as SFW", () => {
    expect(publishedTemplateSfwMedia({ ...template, priceMinor: 500 })).toBeNull();
    expect(workflowMessageMediaSafety({ stepType: "SEND_MESSAGE", config: { manualSfwAttested: true }, mediaUuids: [] })).toBe("UNREVIEWED");
  });
});
