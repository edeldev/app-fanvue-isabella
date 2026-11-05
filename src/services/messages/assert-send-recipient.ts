import { sendEligibilityFailure, type SendEligibilityFailure } from "@/domain/fans/send-eligibility";
import type { MediaSafety } from "@/domain/fans/content-consent";
import { prisma } from "@/lib/prisma";
import { assertFanvueMediaClassification } from "./assert-media-classification";

export class SendRecipientIneligibleError extends Error {
  constructor(readonly code: SendEligibilityFailure) {
    super(code);
    this.name = "SendRecipientIneligibleError";
  }
}

export async function assertSendRecipient(creatorId: string, fanId: string, mediaUuids: string[], isPpv: boolean, mediaSafety: MediaSafety = "UNREVIEWED", token?: string) {
  const fan = await prisma.fan.findFirst({
    where: { creatorId, id: fanId },
    select: { doNotMessage: true, isCreatorAccount: true, isFollower: true, isSubscriber: true, isFreeTrialSubscriber: true, isExpiredSubscriber: true, intimateContentOptIn: true, intimateContentOptInSource: true },
  });
  const failure = sendEligibilityFailure(fan, mediaUuids.length, isPpv, mediaSafety);
  if (failure) throw new SendRecipientIneligibleError(failure);
  if (mediaUuids.length) {
    if (!token) throw new Error("FANVUE_MEDIA_CLASSIFICATION_TOKEN_REQUIRED");
    await assertFanvueMediaClassification(token, mediaUuids, mediaSafety);
  }
}
