import { describe, expect, it } from "vitest";
import { resolveMessagePreviewUuid } from "./ppv-preview";

describe("resolveMessagePreviewUuid", () => {
  it("keeps the explicit Fanvue preview", () => {
    expect(resolveMessagePreviewUuid({
      explicitPreviewUuid: "preview",
      messageMediaUuids: ["locked"],
      resolvedMediaUuids: ["locked", "preview"],
      priceMinor: 5000,
    })).toBe("preview");
  });

  it("does not label the only PPV asset as a free preview", () => {
    expect(resolveMessagePreviewUuid({
      explicitPreviewUuid: null,
      messageMediaUuids: [],
      resolvedMediaUuids: ["locked"],
      priceMinor: 5000,
    })).toBeNull();
  });

  it("infers one extra preview only when locked media is confirmed", () => {
    expect(resolveMessagePreviewUuid({
      explicitPreviewUuid: null,
      messageMediaUuids: ["locked-a", "locked-b"],
      resolvedMediaUuids: ["locked-a", "preview", "locked-b"],
      priceMinor: 5000,
    })).toBe("preview");
  });
});
