import { describe, expect, it } from "vitest";
import { resolveHighestPriority } from "./priority";

describe("resolveHighestPriority", () => {
  it("selects the highest priority candidate", () => {
    expect(resolveHighestPriority([
      { id: "followers", priority: 100, version: 1 },
      { id: "buyers", priority: 300, version: 1 },
      { id: "subscribers", priority: 200, version: 1 },
    ])?.id).toBe("buyers");
  });

  it("prefers the latest version when priorities match", () => {
    expect(resolveHighestPriority([
      { id: "v1", priority: 100, version: 1 },
      { id: "v2", priority: 100, version: 2 },
    ])?.id).toBe("v2");
  });

  it("returns null without candidates", () => {
    expect(resolveHighestPriority([])).toBeNull();
  });
});
