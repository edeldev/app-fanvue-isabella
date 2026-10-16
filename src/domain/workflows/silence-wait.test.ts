import { describe, expect, it } from "vitest";
import { silenceWaitDeadline } from "./silence-wait";

describe("silenceWaitDeadline", () => {
  it("counts the full silence window from the latest fan activity", () => {
    const firstReply = new Date("2026-10-16T16:00:00.000Z");
    const newerReply = new Date("2026-10-16T16:08:00.000Z");

    expect(silenceWaitDeadline(firstReply, 10)).toEqual(new Date("2026-10-16T16:10:00.000Z"));
    expect(silenceWaitDeadline(newerReply, 10)).toEqual(new Date("2026-10-16T16:18:00.000Z"));
  });

  it("rejects an invalid silence window", () => {
    expect(() => silenceWaitDeadline(new Date(), 0)).toThrow("WORKFLOW_SILENCE_MINUTES_INVALID");
  });
});
