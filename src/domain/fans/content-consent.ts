export type ContentConsentFan = {
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  intimateContentOptIn: boolean;
};

export function canReceivePaidOrIntimateContent(fan: ContentConsentFan) {
  return fan.isSubscriber || fan.isFreeTrialSubscriber || fan.intimateContentOptIn;
}
