export type SendRecoveryBlock = "RECOVERY_MESSAGE_ALREADY_SENT" | "RECOVERY_SEND_STATUS_UNCERTAIN";

export function sendRecoveryBlock(input: { reservation: { sentAt: Date | null; failedAt: Date | null } | null; hasFanvueMessageId: boolean }): SendRecoveryBlock | null {
  if (input.reservation?.sentAt || input.hasFanvueMessageId) return "RECOVERY_MESSAGE_ALREADY_SENT";
  if (input.reservation && !input.reservation.failedAt) return "RECOVERY_SEND_STATUS_UNCERTAIN";
  return null;
}
