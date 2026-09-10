import { describe, expect, it } from "vitest";
import { sendRecoveryBlock } from "./failure-recovery";

describe("sendRecoveryBlock", () => {
  it("allows a retry after a confirmed send failure", () => {
    expect(sendRecoveryBlock({ reservation: { sentAt: null, failedAt: new Date() }, hasFanvueMessageId: false })).toBeNull();
  });

  it("blocks a message already recorded as sent", () => {
    expect(sendRecoveryBlock({ reservation: { sentAt: new Date(), failedAt: null }, hasFanvueMessageId: false })).toBe("RECOVERY_MESSAGE_ALREADY_SENT");
  });

  it("blocks a retry when the external send result is uncertain", () => {
    expect(sendRecoveryBlock({ reservation: { sentAt: null, failedAt: null }, hasFanvueMessageId: false })).toBe("RECOVERY_SEND_STATUS_UNCERTAIN");
  });
});
