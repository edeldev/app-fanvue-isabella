import { describe, expect, it } from "vitest";
import { buildFansWhere, fanFilterWhere, parseFanFilter } from "./filters";

describe("fan filters", () => {
  it("rejects unknown filters", () => {
    expect(parseFanFilter("UNKNOWN")).toBe("ALL");
    expect(parseFanFilter("ONLINE")).toBe("ONLINE");
  });

  it("uses confirmed non-reversed tips", () => {
    expect(fanFilterWhere("HAS_TIPPED")).toEqual({ purchases: { some: {
      source: { equals: "tip", mode: "insensitive" }, amountMinor: { gt: 0 }, reversedAt: null,
    } } });
  });

  it("keeps creator and contact boundaries when searching", () => {
    expect(buildFansWhere("creator-1", "ONLINE", " Juan ")).toMatchObject({
      creatorId: "creator-1", isCreatorAccount: false,
      AND: expect.arrayContaining([
        { isOnline: true },
        { OR: expect.arrayContaining([{ displayName: { contains: "Juan", mode: "insensitive" } }]) },
      ]),
    });
  });
});
