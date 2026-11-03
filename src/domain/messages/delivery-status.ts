export type MessageDeliveryState = "SENT" | "DELIVERED" | "READ";

export function resolveMessageDeliveryState({
  isRead = false,
  providerStatus,
  storedStatus,
}: {
  isRead?: boolean;
  providerStatus?: string | null;
  storedStatus?: string | null;
}): MessageDeliveryState | null {
  const provider = providerStatus?.toLocaleUpperCase("en-US") ?? "";
  const stored = storedStatus?.toLocaleUpperCase("en-US") ?? "";
  if (isRead || provider === "READ" || stored === "READ") return "READ";
  if (provider === "DELIVERED" || stored === "DELIVERED") return "DELIVERED";
  if (provider === "SENT" || stored === "SENT") return "SENT";
  return null;
}
