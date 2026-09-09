export const workflowConditions = [
  "IS_FOLLOWER", "IS_FOLLOWER_ONLY", "IS_SUBSCRIBER", "IS_PAID_SUBSCRIBER",
  "IS_FREE_TRIAL_SUBSCRIBER", "IS_AUTO_RENEWING_SUBSCRIBER", "IS_NON_RENEWING_SUBSCRIBER",
  "IS_EXPIRED_SUBSCRIBER", "IS_ONLINE", "IS_MUTED", "IS_CREATOR_ACCOUNT",
  "HAS_PURCHASED", "HAS_NOT_PURCHASED", "SPENT_MORE_THAN_50", "SPENT_LESS_THAN",
  "HAS_SPENT_ZERO", "IS_NOT_SUBSCRIBER", "IS_NOT_FREE_TRIAL_SUBSCRIBER", "IS_TOP_SPENDER",
] as const;
export type WorkflowCondition = (typeof workflowConditions)[number];
export type WorkflowConditionOperator = "ALL" | "ANY";
export type WorkflowConditionRule = { condition: WorkflowCondition; amountMinor?: number };

export const workflowConditionLabels: Record<WorkflowCondition, string> = {
  IS_FOLLOWER: "Sigue actualmente tu cuenta",
  IS_FOLLOWER_ONLY: "Sigue tu cuenta y no tiene acceso activo",
  IS_SUBSCRIBER: "Tiene cualquier suscripción activa",
  IS_PAID_SUBSCRIBER: "Tiene suscripción de pago activa",
  IS_FREE_TRIAL_SUBSCRIBER: "Tiene prueba gratuita activa",
  IS_AUTO_RENEWING_SUBSCRIBER: "Tiene renovación automática",
  IS_NON_RENEWING_SUBSCRIBER: "Tiene la renovación desactivada",
  IS_EXPIRED_SUBSCRIBER: "Tuvo una suscripción que ya terminó",
  IS_ONLINE: "Está conectado ahora",
  IS_MUTED: "Está silenciado",
  IS_CREATOR_ACCOUNT: "Es otra cuenta de creador",
  HAS_PURCHASED: "Ha realizado una compra",
  HAS_NOT_PURCHASED: "No ha realizado ninguna compra",
  SPENT_MORE_THAN_50: "Ha gastado más de una cantidad",
  SPENT_LESS_THAN: "Ha gastado menos de una cantidad",
  HAS_SPENT_ZERO: "Ha gastado exactamente $0",
  IS_NOT_SUBSCRIBER: "No tiene ninguna suscripción activa",
  IS_NOT_FREE_TRIAL_SUBSCRIBER: "No tiene una prueba gratuita activa",
  IS_TOP_SPENDER: "Es VIP",
};

export interface ConditionFan {
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  isAutoRenewingSubscriber: boolean;
  isNonRenewingSubscriber: boolean;
  isExpiredSubscriber: boolean;
  isCreatorAccount: boolean;
  isMuted: boolean;
  isOnline: boolean;
  isTopSpender: boolean;
  totalSpentMinor: number;
  paidPurchasesCount: number;
}

export function evaluateWorkflowCondition(condition: WorkflowCondition, fan: ConditionFan, amountMinor = 5_000) {
  if (condition === "IS_FOLLOWER") return fan.isFollower;
  if (condition === "IS_FOLLOWER_ONLY") return fan.isFollower && !fan.isSubscriber && !fan.isFreeTrialSubscriber;
  if (condition === "IS_SUBSCRIBER") return fan.isSubscriber || fan.isFreeTrialSubscriber;
  if (condition === "IS_PAID_SUBSCRIBER") return fan.isSubscriber && !fan.isFreeTrialSubscriber;
  if (condition === "IS_FREE_TRIAL_SUBSCRIBER") return fan.isFreeTrialSubscriber;
  if (condition === "IS_AUTO_RENEWING_SUBSCRIBER") return fan.isAutoRenewingSubscriber;
  if (condition === "IS_NON_RENEWING_SUBSCRIBER") return fan.isNonRenewingSubscriber;
  if (condition === "IS_EXPIRED_SUBSCRIBER") return fan.isExpiredSubscriber;
  if (condition === "IS_ONLINE") return fan.isOnline;
  if (condition === "IS_MUTED") return fan.isMuted;
  if (condition === "IS_CREATOR_ACCOUNT") return fan.isCreatorAccount;
  if (condition === "HAS_PURCHASED") return fan.paidPurchasesCount > 0;
  if (condition === "HAS_NOT_PURCHASED") return fan.paidPurchasesCount === 0;
  if (condition === "SPENT_MORE_THAN_50") return fan.totalSpentMinor > amountMinor;
  if (condition === "SPENT_LESS_THAN") return fan.totalSpentMinor < amountMinor;
  if (condition === "HAS_SPENT_ZERO") return fan.totalSpentMinor === 0;
  if (condition === "IS_NOT_SUBSCRIBER") return !fan.isSubscriber && !fan.isFreeTrialSubscriber;
  if (condition === "IS_NOT_FREE_TRIAL_SUBSCRIBER") return !fan.isFreeTrialSubscriber;
  return fan.isTopSpender;
}

export function evaluateWorkflowConditionGroup(operator: WorkflowConditionOperator, rules: WorkflowConditionRule[], fan: ConditionFan) {
  if (!rules.length) return false;
  const results = rules.map((rule) => evaluateWorkflowCondition(rule.condition, fan, rule.amountMinor));
  return operator === "ALL" ? results.every(Boolean) : results.some(Boolean);
}
