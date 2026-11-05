export type ContentConsentFan = {
  intimateContentOptIn: boolean;
  intimateContentOptInSource?: string | null;
};

export function canReceivePaidOrIntimateContent(fan: ContentConsentFan) {
  return Boolean(fan.intimateContentOptIn && fan.intimateContentOptInSource?.startsWith("fanvue-message:") && fan.intimateContentOptInSource.length > "fanvue-message:".length);
}

export type MediaSafety = "SFW" | "NSFW" | "UNREVIEWED";

// Every media send is classified. SFW does not need intimate consent; NSFW
// always does, regardless of subscription, renewal or purchase history.
export function canReceiveMessageMedia(fan: ContentConsentFan, mediaCount: number, safety: MediaSafety = "UNREVIEWED") {
  return mediaCount === 0 || safety === "SFW" || (safety === "NSFW" && canReceivePaidOrIntimateContent(fan));
}
