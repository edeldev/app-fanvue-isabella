type SubscriptionPeriod = {
  startedAt: Date;
  currentPeriodEndsAt: Date | null;
  status: string;
};

/** The subscriber list is authoritative for access; stored periods can lag behind renewals. */
export function describeSubscriptionPeriod(
  subscriptions: SubscriptionPeriod[],
  now = new Date(),
) {
  const latest = [...subscriptions].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  if (!latest) return { period: null, endLabel: "Vencimiento", endValue: null, stale: false, pending: false };

  const end = latest.currentPeriodEndsAt;
  const isFuture = Boolean(end && end.getTime() > now.getTime());
  const confirmed = latest.status === "ACTIVE" || latest.status === "CANCEL_AT_PERIOD_END";
  return {
    period: latest,
    endLabel: isFuture ? (confirmed ? "Acceso hasta" : "Acceso hasta (estimado)") : "Vencimiento",
    endValue: isFuture ? end : null,
    stale: Boolean(end && !isFuture),
    pending: !confirmed,
  };
}
