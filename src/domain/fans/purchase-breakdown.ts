export type PurchaseLike = {
  amountMinor: number;
  source: string;
  externalMessageId?: string | null;
  externalPostId?: string | null;
  reversedAt?: Date | string | null;
};

export type RevenueCategory = "subscriptions" | "messagePpv" | "feedPpv" | "tips" | "other";

export function purchaseCategory(purchase: PurchaseLike): RevenueCategory {
  const source = purchase.source.trim().toLocaleLowerCase("en-US");
  if (source === "tip" || source.includes("tip")) return "tips";
  if (source === "subscription" || source === "renewal" || source.includes("subscription")) return "subscriptions";
  if (purchase.externalMessageId || source === "message" || source.includes("message")) return "messagePpv";
  if (purchase.externalPostId || source === "post" || source === "feed" || source.includes("post")) return "feedPpv";
  return "other";
}

export function buildPurchaseBreakdown(purchases: PurchaseLike[]) {
  const result = {
    subscriptions: { amountMinor: 0, count: 0 },
    messagePpv: { amountMinor: 0, count: 0 },
    feedPpv: { amountMinor: 0, count: 0 },
    tips: { amountMinor: 0, count: 0 },
    other: { amountMinor: 0, count: 0 },
  };
  for (const purchase of purchases) {
    if (purchase.amountMinor <= 0 || purchase.reversedAt) continue;
    const category = purchaseCategory(purchase);
    result[category].amountMinor += purchase.amountMinor;
    result[category].count += 1;
  }
  return result;
}

export function primaryRevenueCategory(breakdown: ReturnType<typeof buildPurchaseBreakdown>) {
  const entries = Object.entries(breakdown) as Array<[RevenueCategory, { amountMinor: number; count: number }]>;
  return entries.sort((left, right) => right[1].amountMinor - left[1].amountMinor)[0]?.[1].amountMinor
    ? entries[0][0]
    : null;
}

export const revenueCategoryLabels: Record<RevenueCategory, string> = {
  subscriptions: "Suscripciones",
  messagePpv: "PPV en mensajes",
  feedPpv: "PPV en feed",
  tips: "Propinas",
  other: "Otras compras",
};
