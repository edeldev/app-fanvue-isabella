export type ContentConsentFan = {
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  intimateContentOptIn: boolean;
  intimateContentOptInSource?: string | null;
};

export function canReceivePaidOrIntimateContent(fan: ContentConsentFan) {
  return fan.isSubscriber || fan.isFreeTrialSubscriber || Boolean(fan.intimateContentOptIn && fan.intimateContentOptInSource?.startsWith("fanvue-message:") && fan.intimateContentOptInSource.length > "fanvue-message:".length);
}

export type MediaSafety = "SFW" | "UNREVIEWED";

// A creator may explicitly classify a free send as SFW. Unclassified media
// remains restricted for non-subscribers.
export function canReceiveMessageMedia(fan: ContentConsentFan, mediaCount: number, safety: MediaSafety = "UNREVIEWED") {
  return mediaCount === 0 || safety === "SFW" || canReceivePaidOrIntimateContent(fan);
}
