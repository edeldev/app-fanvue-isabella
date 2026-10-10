import { describe, expect, it } from "vitest";
import { fanvuePostsPageSchema } from "./post-schemas";

describe("fanvuePostsPageSchema", () => {
  it("accepts the nullable total returned by Fanvue", () => {
    const result = fanvuePostsPageSchema.safeParse({
      data: [{
        uuid: "32e14282-2804-4ad1-a19e-181566127758",
        createdAt: "2026-10-10T14:13:06.569Z",
        text: "Caption",
        price: null,
        mediaUuids: ["d513d700-3c25-4a88-b6e4-0e589203fa9a"],
        mediaPreviewUuid: null,
        audience: "subscribers",
        publishAt: null,
        publishedAt: "2026-10-10T14:13:06.567Z",
        expiresAt: null,
        commentsCount: 2,
        likesCount: 4,
      }],
      nextCursor: "cursor",
      total: null,
    });

    expect(result.success).toBe(true);
    expect(result.data?.data[0]?.mediaUuids).toHaveLength(1);
    expect(result.data?.data[0]?.likesCount).toBe(4);
  });
});
