import { describe, expect, it } from "vitest";
import { scheduledMediaIsNsfw } from "./scheduled-content-rating";

describe("scheduledMediaIsNsfw", () => {
  it("recognizes only an explicit NSFW classification", () => {
    expect(scheduledMediaIsNsfw([{ contentRating: "NSFW" }])).toBe(true);
    expect(scheduledMediaIsNsfw([{ contentRating: "SFW" }])).toBe(false);
    expect(scheduledMediaIsNsfw([{ sfwAttested: false }])).toBe(false);
  });
});
