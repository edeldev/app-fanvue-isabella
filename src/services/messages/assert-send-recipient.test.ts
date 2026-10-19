import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { fan: { findFirst } } }));

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
  beforeEach(() => findFirst.mockReset());

  it("reads the current fan state instead of trusting a previously loaded fan", async () => {
    findFirst.mockResolvedValue({ ...eligibleFan, doNotMessage: true });
    await expect(assertSendRecipient("creator-1", "fan-1", 0, false)).rejects.toMatchObject({
      name: "SendRecipientIneligibleError",
      code: "FAN_DO_NOT_MESSAGE",
    } satisfies Partial<SendRecipientIneligibleError>);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { creatorId: "creator-1", id: "fan-1" },
    }));
  });

  it("blocks a recipient removed from the creator's audience", async () => {
    findFirst.mockResolvedValue(null);
    await expect(assertSendRecipient("creator-1", "fan-1", 0, false)).rejects.toMatchObject({
      code: "INVALID_RECIPIENT",
    });
  });

  it("allows an eligible text message but blocks media without opt-in", async () => {
    findFirst.mockResolvedValue(eligibleFan);
    await expect(assertSendRecipient("creator-1", "fan-1", 0, false)).resolves.toBeUndefined();
    await expect(assertSendRecipient("creator-1", "fan-1", 1, false)).rejects.toMatchObject({
      code: "EXPLICIT_CONTENT_OPT_IN_REQUIRED",
    });
  });
});
