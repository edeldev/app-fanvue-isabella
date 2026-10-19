import { describe, expect, it } from "vitest";
import { sendEligibilityFailure } from "./send-eligibility";

const fan = { doNotMessage: false, isCreatorAccount: false, isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false, isExpiredSubscriber: false, intimateContentOptIn: false };

describe("sendEligibilityFailure", () => {
  it("honors opt-out even for text", () => {
    expect(sendEligibilityFailure({ ...fan, doNotMessage: true }, 0, false)).toBe("FAN_DO_NOT_MESSAGE");
  });

  it("requires current consent for media and PPV", () => {
    expect(sendEligibilityFailure(fan, 1, false)).toBe("EXPLICIT_CONTENT_OPT_IN_REQUIRED");
    expect(sendEligibilityFailure(fan, 1, true)).toBe("EXPLICIT_CONTENT_OPT_IN_REQUIRED");
    expect(sendEligibilityFailure({ ...fan, intimateContentOptIn: true }, 1, true)).toBe("EXPLICIT_CONTENT_OPT_IN_REQUIRED");
    expect(sendEligibilityFailure({ ...fan, intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:msg-1" }, 1, true)).toBeNull();
  });

  it("rejects creator accounts and lost audience membership", () => {
    expect(sendEligibilityFailure({ ...fan, isCreatorAccount: true }, 0, false)).toBe("INVALID_RECIPIENT");
    expect(sendEligibilityFailure({ ...fan, isFollower: false }, 0, false)).toBe("INVALID_RECIPIENT");
  });
});
