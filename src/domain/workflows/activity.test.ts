import { describe, expect, it } from "vitest";
import { activityRetentionCutoff } from "./activity";

describe("activityRetentionCutoff", () => {
  it("returns the date 90 days earlier", () => {
    expect(activityRetentionCutoff(new Date("2026-09-05T12:00:00.000Z"))).toEqual(
      new Date("2026-06-07T12:00:00.000Z"),
    );
  });
});
