import { describe, expect, it } from "vitest";
import { audienceSegmentWhere, buildAudienceWhere } from "./audience";

describe("workflow audiences", () => {
  it("maps paid subscribers without free trials", () => {
    expect(audienceSegmentWhere("PAID_SUBSCRIBERS")).toEqual({ isSubscriber: true, isFreeTrialSubscriber: false });
  });

  it("combines inclusions and exclusions safely", () => {
    expect(buildAudienceWhere("creator-1", ["FOLLOWERS", "FREE_TRIAL_SUBSCRIBERS"], ["MUTED"])).toEqual({
      creatorId: "creator-1", isCreatorAccount: false,
      OR: [{ isFollower: true }, { isFreeTrialSubscriber: true }],
      NOT: { OR: [{ isMuted: true }] },
    });
  });
});
