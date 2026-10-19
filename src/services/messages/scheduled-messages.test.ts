import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  fanvueRequest: vi.fn(),
  getValidFanvueAccessToken: vi.fn(),
  assertSendRecipient: vi.fn(),
  reserveAutomatedSendBudget: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scheduledMessage: {
      updateMany: mocks.updateMany,
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/fanvue/client", () => ({ fanvueRequest: mocks.fanvueRequest }));
vi.mock("@/services/fanvue/get-access-token", () => ({ getValidFanvueAccessToken: mocks.getValidFanvueAccessToken }));
vi.mock("@/services/messages/assert-send-recipient", () => ({
  assertSendRecipient: mocks.assertSendRecipient,
  SendRecipientIneligibleError: class SendRecipientIneligibleError extends Error { constructor(readonly code: string) { super(code); } },
}));
vi.mock("@/services/messages/automated-send-budget", () => ({ reserveAutomatedSendBudget: mocks.reserveAutomatedSendBudget }));

import { runDueScheduledMessages } from "./scheduled-messages";
import { SendRecipientIneligibleError } from "./assert-send-recipient";

const now = new Date("2026-10-19T15:00:00.000Z");
const item = {
  id: "message-1",
  creatorId: "creator-1",
  fanId: "fan-1",
  fan: { fanvueUserId: "fanvue-1", doNotMessage: false, isCreatorAccount: false, isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false, isExpiredSubscriber: false, intimateContentOptIn: false },
  creator: { settings: { sendLimitsEnabled: false } },
  template: null,
  templateId: null,
  media: [],
  mediaPreviewUuid: null,
  priceMinor: null,
  text: "Hola",
};

describe("runDueScheduledMessages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findMany.mockResolvedValue([{ id: item.id }]);
    mocks.findUnique.mockResolvedValue(item);
    mocks.update.mockResolvedValue({});
    mocks.getValidFanvueAccessToken.mockResolvedValue("token");
    mocks.reserveAutomatedSendBudget.mockResolvedValue({ allowed: true });
  });

  it("moves interrupted SENDING messages to manual review and only claims PENDING ones", async () => {
    mocks.findMany.mockResolvedValue([]);
    await runDueScheduledMessages(now);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { status: "SENDING", updatedAt: { lt: new Date("2026-10-19T14:55:00.000Z") } },
      data: { status: "NEEDS_REVIEW", lastError: "DELIVERY_STATUS_UNKNOWN_CHECK_FANVUE" },
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { scheduledAt: { lte: now }, status: "PENDING" } }));
    expect(mocks.fanvueRequest).not.toHaveBeenCalled();
  });

  it("blocks a newly opted-out fan without calling Fanvue", async () => {
    mocks.findUnique.mockResolvedValue({ ...item, fan: { ...item.fan, doNotMessage: true } });
    const result = await runDueScheduledMessages(now);
    expect(result.blocked).toBe(1);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: item.id }, data: { status: "BLOCKED", lastError: "FAN_DO_NOT_MESSAGE" } });
    expect(mocks.fanvueRequest).not.toHaveBeenCalled();
  });

  it("reserves the mandatory global budget even when legacy settings disabled it", async () => {
    mocks.fanvueRequest.mockRejectedValue(new Error("network disconnected"));
    await runDueScheduledMessages(now);
    expect(mocks.reserveAutomatedSendBudget).toHaveBeenCalledWith({
      creatorId: item.creatorId,
      fanId: item.fanId,
      limits: { maxMessagesPerHour: 30, maxMessagesPerDay: 200, minMinutesBetweenFanMessages: 0 },
      now,
    });
  });

  it("blocks a fan who opts out after the scheduled item was loaded", async () => {
    mocks.assertSendRecipient.mockRejectedValue(new SendRecipientIneligibleError("FAN_DO_NOT_MESSAGE"));
    const result = await runDueScheduledMessages(now);
    expect(result.blocked).toBe(1);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: item.id }, data: { status: "BLOCKED", lastError: "FAN_DO_NOT_MESSAGE" } });
    expect(mocks.fanvueRequest).not.toHaveBeenCalled();
  });

  it("keeps an ambiguous Fanvue result out of the automatic retry queue", async () => {
    mocks.fanvueRequest.mockRejectedValue(new Error("network disconnected"));
    const result = await runDueScheduledMessages(now);
    expect(result.failed).toBe(1);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: item.id },
      data: expect.objectContaining({ status: "NEEDS_REVIEW" }),
    }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }));
  });
});
