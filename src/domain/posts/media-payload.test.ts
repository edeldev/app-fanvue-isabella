import { describe, expect, it } from "vitest";
import { buildPostMediaPayload } from "./media-payload";

describe("buildPostMediaPayload", () => {
  it("separates a free preview from locked PPV media", () => {
    expect(buildPostMediaPayload(["preview", "locked-1", "locked-2"], 999, "preview")).toEqual({
      mediaUuids: ["locked-1", "locked-2"],
      mediaPreviewUuid: "preview",
    });
  });

  it("keeps every item for a free post", () => {
    expect(buildPostMediaPayload(["first", "second"], null, "first")).toEqual({
      mediaUuids: ["first", "second"],
      mediaPreviewUuid: undefined,
    });
  });

  it("keeps all paid media when there is no free preview", () => {
    expect(buildPostMediaPayload(["locked-1", "locked-2"], 999, null)).toEqual({
      mediaUuids: ["locked-1", "locked-2"],
      mediaPreviewUuid: undefined,
    });
  });
});

