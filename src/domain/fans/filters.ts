import type { Prisma } from "@prisma/client";

export const fanFilters = ["ALL", "ONLINE", "FOLLOWERS", "FOLLOWERS_ONLY", "ACTIVE_SUBSCRIBERS", "PAID_SUBSCRIBERS", "FREE_TRIAL_SUBSCRIBERS", "AUTO_RENEWING", "NON_RENEWING", "EXPIRED_SUBSCRIBERS", "SPENT_MORE_THAN_50", "HAS_TIPPED", "HAS_PURCHASED", "TOP_SPENDERS"] as const;
export type FanFilter = (typeof fanFilters)[number];
export const ONLINE_PRESENCE_TTL_MS = 10 * 60 * 1_000;

export const fanFilterOptions: Array<{ value: FanFilter; label: string; description: string }> = [
  { value: "ALL", label: "Todos", description: "Todos tus contactos reales de Fanvue." },
  { value: "ONLINE", label: "En línea ahora", description: "Fans cuya presencia más reciente indica que están conectados." },
  { value: "FOLLOWERS", label: "Seguidores", description: "Personas que siguen actualmente tu cuenta, tengan o no suscripción." },
  { value: "FOLLOWERS_ONLY", label: "Solo seguidores", description: "Te siguen, pero no tienen acceso activo de pago ni de prueba." },
  { value: "ACTIVE_SUBSCRIBERS", label: "Suscriptores activos", description: "Tienen acceso activo, de pago o prueba gratuita." },
  { value: "PAID_SUBSCRIBERS", label: "Suscriptores de pago", description: "Tienen una suscripción activa pagada." },
  { value: "FREE_TRIAL_SUBSCRIBERS", label: "Prueba gratuita", description: "Tienen una suscripción de prueba gratuita activa." },
  { value: "AUTO_RENEWING", label: "Renovación automática", description: "Su suscripción está configurada para renovarse." },
  { value: "NON_RENEWING", label: "No renovarán", description: "Tienen acceso activo, pero la renovación está desactivada." },
  { value: "EXPIRED_SUBSCRIBERS", label: "Suscripción vencida", description: "Tuvieron acceso anteriormente y su suscripción ya venció." },
  { value: "SPENT_MORE_THAN_50", label: "Gastaron más de $50", description: "Su gasto histórico confirmado supera $50 USD." },
  { value: "HAS_TIPPED", label: "Dieron propina", description: "Tienen al menos una propina confirmada y no reembolsada." },
  { value: "HAS_PURCHASED", label: "Realizaron una compra", description: "Tienen al menos un pago positivo confirmado." },
  { value: "TOP_SPENDERS", label: "VIP", description: "Fanvue los identifica como top spender y tienen gasto confirmado mayor a $0." },
];

export function parseFanFilter(value: string | undefined): FanFilter {
  return fanFilters.includes(value as FanFilter) ? (value as FanFilter) : "ALL";
}

export function fanFilterWhere(filter: FanFilter, now = new Date()): Prisma.FanWhereInput {
  if (filter === "ONLINE") return {
    isOnline: true,
    presenceChangedAt: { gte: new Date(now.getTime() - ONLINE_PRESENCE_TTL_MS) },
  };
  if (filter === "FOLLOWERS") return { isFollower: true };
  if (filter === "FOLLOWERS_ONLY") return { isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false };
  if (filter === "ACTIVE_SUBSCRIBERS") return { OR: [{ isSubscriber: true }, { isFreeTrialSubscriber: true }] };
  if (filter === "PAID_SUBSCRIBERS") return { isSubscriber: true, isFreeTrialSubscriber: false };
  if (filter === "FREE_TRIAL_SUBSCRIBERS") return { isFreeTrialSubscriber: true };
  if (filter === "AUTO_RENEWING") return { isAutoRenewingSubscriber: true };
  if (filter === "NON_RENEWING") return { isNonRenewingSubscriber: true };
  if (filter === "EXPIRED_SUBSCRIBERS") return { isExpiredSubscriber: true };
  if (filter === "SPENT_MORE_THAN_50") return { totalSpentMinor: { gt: 5_000 } };
  if (filter === "HAS_TIPPED") return { purchases: { some: { source: { equals: "tip", mode: "insensitive" }, amountMinor: { gt: 0 }, reversedAt: null } } };
  if (filter === "HAS_PURCHASED") return { purchases: { some: { amountMinor: { gt: 0 }, reversedAt: null } } };
  if (filter === "TOP_SPENDERS") return { isTopSpender: true, totalSpentMinor: { gt: 0 } };
  return {};
}

export function buildFansWhere(creatorId: string, filter: FanFilter, search: string, now = new Date()): Prisma.FanWhereInput {
  const normalizedSearch = search.trim().slice(0, 80);
  return {
    creatorId,
    isCreatorAccount: false,
    AND: [
      { OR: [{ isFollower: true }, { isSubscriber: true }, { isFreeTrialSubscriber: true }, { isExpiredSubscriber: true }] },
      fanFilterWhere(filter, now),
      ...(normalizedSearch ? [{ OR: [
        { displayName: { contains: normalizedSearch, mode: "insensitive" as const } },
        { username: { contains: normalizedSearch, mode: "insensitive" as const } },
      ] }] : []),
    ],
  };
}

export function isFanOnlineNow(isOnline: boolean, presenceChangedAt: Date | null, now = new Date()) {
  return isOnline
    && presenceChangedAt !== null
    && presenceChangedAt.getTime() >= now.getTime() - ONLINE_PRESENCE_TTL_MS;
}

export function isFreshFanvueOnline(
  online: boolean | undefined,
  lastSeenAt: string | null | undefined,
  now = new Date(),
) {
  if (online !== true) return false;
  if (!lastSeenAt) return true;
  const lastSeenTime = new Date(lastSeenAt).getTime();
  return Number.isFinite(lastSeenTime)
    && lastSeenTime >= now.getTime() - ONLINE_PRESENCE_TTL_MS;
}

export function isConfirmedVip(isTopSpender: boolean, totalSpentMinor: number) {
  return isTopSpender && totalSpentMinor > 0;
}
