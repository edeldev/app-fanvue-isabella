import { describe, expect, it } from "vitest";
import { hasLockedPpvMedia } from "./ppv";

describe("hasLockedPpvMedia", () => {
  it("accepts one locked file when there is no free preview", () => {
    expect(hasLockedPpvMedia([{ uuid: "locked" }], null)).toBe(true);
  });

  it("rejects a PPV that only contains its free preview", () => {
    expect(hasLockedPpvMedia([{ uuid: "preview" }], "preview")).toBe(false);
  });

  it("accepts a free preview followed by locked content", () => {
    expect(
      hasLockedPpvMedia(
        [{ uuid: "preview" }, { uuid: "locked" }],
        "preview",
      ),
    ).toBe(true);
  });
});

