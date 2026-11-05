import { canReceiveMessageMedia, type ContentConsentFan, type MediaSafety } from "./content-consent";

export type SendEligibilityFan = ContentConsentFan & {
  doNotMessage: boolean;
  isCreatorAccount: boolean;
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isExpiredSubscriber: boolean;
};

export type SendEligibilityFailure = "FAN_DO_NOT_MESSAGE" | "INVALID_RECIPIENT" | "CONTENT_CLASSIFICATION_REQUIRED" | "EXPLICIT_CONTENT_OPT_IN_REQUIRED";

export function sendEligibilityFailure(fan: SendEligibilityFan | null, mediaCount: number, isPpv: boolean, mediaSafety: MediaSafety = "UNREVIEWED"): SendEligibilityFailure | null {
  if (!fan || fan.isCreatorAccount || (!fan.isFollower && !fan.isSubscriber && !fan.isFreeTrialSubscriber && !fan.isExpiredSubscriber)) return "INVALID_RECIPIENT";
  if (fan.doNotMessage) return "FAN_DO_NOT_MESSAGE";
  if (mediaCount > 0 && mediaSafety === "UNREVIEWED") return "CONTENT_CLASSIFICATION_REQUIRED";
  if (!canReceiveMessageMedia(fan, mediaCount, mediaSafety)) return "EXPLICIT_CONTENT_OPT_IN_REQUIRED";
  // A price does not make SFW media intimate. Conversely, PPV marked NSFW is
  // protected by the exact same verified-consent rule as free NSFW media.
  void isPpv;
  return null;
}
