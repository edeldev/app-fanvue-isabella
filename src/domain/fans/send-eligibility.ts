import { canReceiveMessageMedia, canReceivePaidOrIntimateContent, type ContentConsentFan, type MediaSafety } from "./content-consent";

export type SendEligibilityFan = ContentConsentFan & {
  doNotMessage: boolean;
  isCreatorAccount: boolean;
  isFollower: boolean;
  isExpiredSubscriber: boolean;
};

export type SendEligibilityFailure = "FAN_DO_NOT_MESSAGE" | "INVALID_RECIPIENT" | "EXPLICIT_CONTENT_OPT_IN_REQUIRED";

export function sendEligibilityFailure(fan: SendEligibilityFan | null, mediaCount: number, isPpv: boolean, mediaSafety: MediaSafety = "UNREVIEWED"): SendEligibilityFailure | null {
  if (!fan || fan.isCreatorAccount || (!fan.isFollower && !fan.isSubscriber && !fan.isFreeTrialSubscriber && !fan.isExpiredSubscriber)) return "INVALID_RECIPIENT";
  if (fan.doNotMessage) return "FAN_DO_NOT_MESSAGE";
  if ((isPpv && !canReceivePaidOrIntimateContent(fan)) || !canReceiveMessageMedia(fan, mediaCount, isPpv ? "UNREVIEWED" : mediaSafety)) return "EXPLICIT_CONTENT_OPT_IN_REQUIRED";
  return null;
}
