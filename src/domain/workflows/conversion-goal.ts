export const workflowGoalTypes = ["NONE", "PAID_SUBSCRIPTION", "FIRST_PURCHASE", "ANY_PURCHASE", "PPV_PURCHASE", "TIP_RECEIVED", "SPEND_AMOUNT"] as const;
export type WorkflowGoalType = (typeof workflowGoalTypes)[number];

export const workflowGoalLabels: Record<WorkflowGoalType, string> = {
  NONE: "Sin objetivo automático",
  PAID_SUBSCRIPTION: "Activó una suscripción de pago",
  FIRST_PURCHASE: "Realizó su primera compra",
  ANY_PURCHASE: "Realizó una compra",
  PPV_PURCHASE: "Compró un PPV",
  TIP_RECEIVED: "Envió una propina",
  SPEND_AMOUNT: "Alcanzó una cantidad gastada",
};

export interface GoalEvent {
  kind: "PAID_SUBSCRIPTION" | "PAYMENT";
  amountMinor?: number;
  totalSpentMinor?: number;
  paidPurchasesCount?: number;
  isPpv?: boolean;
  isTip?: boolean;
}

export function matchesWorkflowGoal(goalType: WorkflowGoalType, goalAmountMinor: number | null, event: GoalEvent) {
  if (goalType === "NONE") return false;
  if (goalType === "PAID_SUBSCRIPTION") return event.kind === "PAID_SUBSCRIPTION";
  if (event.kind !== "PAYMENT" || (event.amountMinor ?? 0) <= 0) return false;
  if (goalType === "FIRST_PURCHASE") return event.paidPurchasesCount === 1;
  if (goalType === "ANY_PURCHASE") return true;
  if (goalType === "PPV_PURCHASE") return event.isPpv === true;
  if (goalType === "TIP_RECEIVED") return event.isTip === true;
  return goalType === "SPEND_AMOUNT" && goalAmountMinor !== null && (event.totalSpentMinor ?? 0) >= goalAmountMinor;
}
