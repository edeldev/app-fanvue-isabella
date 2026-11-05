import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, assertFanvueMediaClassification } = vi.hoisted(() => ({ findFirst: vi.fn(), assertFanvueMediaClassification: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { fan: { findFirst } } }));
vi.mock("./assert-media-classification", () => ({ assertFanvueMediaClassification }));

import { assertSendRecipient, SendRecipientIneligibleError } from "./assert-send-recipient";

const eligibleFan = {
  doNotMessage: false,
  isCreatorAccount: false,
  isFollower: true,
  isSubscriber: false,
  isFreeTrialSubscriber: false,
  isExpiredSubscriber: false,
  intimateContentOptIn: false,
};

describe("assertSendRecipient", () => {
  beforeEach(() => {
    findFirst.mockReset();
    assertFanvueMediaClassification.mockReset();
  });

  it("reads the current fan state instead of trusting a previously loaded fan", async () => {
    findFirst.mockResolvedValue({ ...eligibleFan, doNotMessage: true });
    await expect(assertSendRecipient("creator-1", "fan-1", [], false)).rejects.toMatchObject({
      name: "SendRecipientIneligibleError",
      code: "FAN_DO_NOT_MESSAGE",
    } satisfies Partial<SendRecipientIneligibleError>);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { creatorId: "creator-1", id: "fan-1" },
    }));
  });

  it("blocks a recipient removed from the creator's audience", async () => {
    findFirst.mockResolvedValue(null);
    await expect(assertSendRecipient("creator-1", "fan-1", [], false)).rejects.toMatchObject({
      code: "INVALID_RECIPIENT",
    });
  });

  it("allows an eligible text message but blocks media without opt-in", async () => {
    findFirst.mockResolvedValue(eligibleFan);
    await expect(assertSendRecipient("creator-1", "fan-1", [], false)).resolves.toBeUndefined();
    await expect(assertSendRecipient("creator-1", "fan-1", ["media-1"], false)).rejects.toMatchObject({
      code: "CONTENT_CLASSIFICATION_REQUIRED",
    });
  });

  it("allows NSFW only with verified current consent and official classification", async () => {
    findFirst.mockResolvedValue({ ...eligibleFan, intimateContentOptIn: true, intimateContentOptInSource: "fanvue-message:msg-1" });
    assertFanvueMediaClassification.mockResolvedValue(undefined);
    await expect(assertSendRecipient("creator-1", "fan-1", ["media-1"], true, "NSFW", "token")).resolves.toBeUndefined();
    expect(assertFanvueMediaClassification).toHaveBeenCalledWith("token", ["media-1"], "NSFW");
  });
});
