export type ContentConsentFan = {
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  intimateContentOptIn: boolean;
  intimateContentOptInSource?: string | null;
};

export function canReceivePaidOrIntimateContent(fan: ContentConsentFan) {
  return fan.isSubscriber || fan.isFreeTrialSubscriber || Boolean(fan.intimateContentOptIn && fan.intimateContentOptInSource?.startsWith("fanvue-message:") && fan.intimateContentOptInSource.length > "fanvue-message:".length);
}

// Free media may also be intimate. Without a reliable media classification,
// require the same opt-in for every media attachment sent to non-subscribers.
export function canReceiveMessageMedia(fan: ContentConsentFan, mediaCount: number) {
  return mediaCount === 0 || canReceivePaidOrIntimateContent(fan);
}
