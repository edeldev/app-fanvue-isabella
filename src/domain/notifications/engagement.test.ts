import { describe, expect, it } from "vitest";
import { engagementCopy } from "./engagement";

describe("engagement notification copy", () => {
  it("describes a new follower", () => {
    expect(engagementCopy("FOLLOW_CREATED", "Ana", {})).toEqual({
      title: "Nuevo seguidor",
      message: "Ana comenzó a seguirte.",
    });
  });

  it("includes comment text when Fanvue sends it", () => {
    expect(engagementCopy("POST_COMMENTED", "Leo", { commentText: "Me encanta" })).toEqual({
      title: "Nuevo comentario",
      message: "Leo: Me encanta",
    });
  });
});
