import { describe, expect, it } from "vitest";
import { buildFansWhere, fanFilterWhere, isFanOnlineNow, parseFanFilter } from "./filters";

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

  it("expires online presence when Fanvue omits the offline event", () => {
    const now = new Date("2026-09-11T15:00:00.000Z");
    expect(fanFilterWhere("ONLINE", now)).toEqual({
      isOnline: true,
      presenceChangedAt: { gte: new Date("2026-09-11T14:50:00.000Z") },
    });
    expect(isFanOnlineNow(true, new Date("2026-09-11T14:55:00.000Z"), now)).toBe(true);
    expect(isFanOnlineNow(true, new Date("2026-09-11T14:49:59.999Z"), now)).toBe(false);
    expect(isFanOnlineNow(false, new Date("2026-09-11T14:59:00.000Z"), now)).toBe(false);
  });

  it("keeps creator and contact boundaries when searching", () => {
    expect(buildFansWhere("creator-1", "ONLINE", " Juan ", new Date("2026-09-11T15:00:00.000Z"))).toMatchObject({
      creatorId: "creator-1", isCreatorAccount: false,
      AND: expect.arrayContaining([
        { isOnline: true, presenceChangedAt: { gte: new Date("2026-09-11T14:50:00.000Z") } },
        { OR: expect.arrayContaining([{ displayName: { contains: "Juan", mode: "insensitive" } }]) },
      ]),
    });
  });
});
