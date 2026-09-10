import type { Prisma } from "@prisma/client";

export const audienceSegments = [
  "ALL_CONTACTS", "FOLLOWERS", "FOLLOWERS_ONLY", "ACTIVE_SUBSCRIBERS",
  "PAID_SUBSCRIBERS", "FREE_TRIAL_SUBSCRIBERS", "AUTO_RENEWING",
  "NON_RENEWING", "EXPIRED_SUBSCRIBERS", "ONLINE", "MUTED",
  "SPENT_MORE_THAN_50",
] as const;

export type AudienceSegment = (typeof audienceSegments)[number];

export const audienceSegmentLabels: Record<AudienceSegment, string> = {
  ALL_CONTACTS: "Todos los contactos",
  FOLLOWERS: "Siguen actualmente tu cuenta",
  FOLLOWERS_ONLY: "Seguidores sin acceso activo",
  ACTIVE_SUBSCRIBERS: "Cualquier suscripción activa",
  PAID_SUBSCRIBERS: "Suscriptores de pago",
  FREE_TRIAL_SUBSCRIBERS: "Suscriptores de prueba gratuita",
  AUTO_RENEWING: "Renovación automática",
  NON_RENEWING: "Renovación desactivada",
  EXPIRED_SUBSCRIBERS: "Suscriptores caducados",
  ONLINE: "En línea ahora",
  MUTED: "Silenciados",
  SPENT_MORE_THAN_50: "Gastaron más de $50",
};

export function audienceSegmentWhere(segment: AudienceSegment): Prisma.FanWhereInput {
  if (segment === "ALL_CONTACTS") return { OR: [{ isFollower: true }, { isSubscriber: true }, { isFreeTrialSubscriber: true }, { isExpiredSubscriber: true }] };
  if (segment === "FOLLOWERS") return { isFollower: true };
  if (segment === "FOLLOWERS_ONLY") return { isFollower: true, isSubscriber: false, isFreeTrialSubscriber: false };
  if (segment === "ACTIVE_SUBSCRIBERS") return { OR: [{ isSubscriber: true }, { isFreeTrialSubscriber: true }] };
  if (segment === "PAID_SUBSCRIBERS") return { isSubscriber: true, isFreeTrialSubscriber: false };
  if (segment === "FREE_TRIAL_SUBSCRIBERS") return { isFreeTrialSubscriber: true };
  if (segment === "AUTO_RENEWING") return { isAutoRenewingSubscriber: true };
  if (segment === "NON_RENEWING") return { isNonRenewingSubscriber: true };
  if (segment === "EXPIRED_SUBSCRIBERS") return { isExpiredSubscriber: true };
  if (segment === "ONLINE") return { isOnline: true };
  if (segment === "MUTED") return { isMuted: true };
  return { totalSpentMinor: { gt: 5_000 } };
}

export function buildAudienceWhere(creatorId: string, include: AudienceSegment[], exclude: AudienceSegment[]): Prisma.FanWhereInput {
  return {
    creatorId,
    isCreatorAccount: false,
    OR: include.map(audienceSegmentWhere),
    ...(exclude.length ? { NOT: { OR: exclude.map(audienceSegmentWhere) } } : {}),
  };
}
