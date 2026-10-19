import { sendEligibilityFailure, type SendEligibilityFailure } from "@/domain/fans/send-eligibility";
import { prisma } from "@/lib/prisma";

export class SendRecipientIneligibleError extends Error {
  constructor(readonly code: SendEligibilityFailure) {
    super(code);
    this.name = "SendRecipientIneligibleError";
  }
}

export async function assertSendRecipient(creatorId: string, fanId: string, mediaCount: number, isPpv: boolean) {
  const fan = await prisma.fan.findFirst({
    where: { creatorId, id: fanId },
    select: { doNotMessage: true, isCreatorAccount: true, isFollower: true, isSubscriber: true, isFreeTrialSubscriber: true, isExpiredSubscriber: true, intimateContentOptIn: true, intimateContentOptInSource: true },
  });
  const failure = sendEligibilityFailure(fan, mediaCount, isPpv);
  if (failure) throw new SendRecipientIneligibleError(failure);
}
