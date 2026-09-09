export const workflowReentryPolicies = ["ONCE", "AFTER_DELAY", "EVERY_EVENT"] as const;

export type WorkflowReentryPolicy = (typeof workflowReentryPolicies)[number];

export const workflowReentryPolicyLabels: Record<WorkflowReentryPolicy, string> = {
  ONCE: "Solo una vez por fan",
  AFTER_DELAY: "Permitir nuevamente después de varios días",
  EVERY_EVENT: "En cada evento",
};

export function reentryBlockedReason(
  policy: WorkflowReentryPolicy,
  priorEnrollment: { reentryReferenceAt: Date } | null,
  delayDays: number | null,
  now: Date,
) {
  if (!priorEnrollment) return null;
  if (policy === "ONCE") return { code: "WORKFLOW_REENTRY_ONCE" as const, eligibleAt: null };
  if (policy !== "AFTER_DELAY") return null;
  const eligibleAt = new Date(priorEnrollment.reentryReferenceAt.getTime() + (delayDays ?? 1) * 86_400_000);
  return eligibleAt > now ? { code: "WORKFLOW_REENTRY_COOLDOWN" as const, eligibleAt } : null;
}
