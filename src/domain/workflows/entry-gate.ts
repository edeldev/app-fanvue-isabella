import {
  evaluateWorkflowConditionGroup,
  workflowConditions,
  type ConditionFan,
  type WorkflowCondition,
  type WorkflowConditionOperator,
  type WorkflowConditionRule,
} from "./evaluate-condition";

type StepLike = { type: string; config: unknown };

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function workflowEntryGate(steps: StepLike[]) {
  const step = steps.find((candidate) => {
    const config = record(candidate.config);
    return candidate.type === "CONDITION" && config.entryGate === true;
  });
  if (!step) return null;
  const config = record(step.config);
  const rules = Array.isArray(config.conditions)
    ? config.conditions.flatMap((value): WorkflowConditionRule[] => {
        const rule = record(value);
        const condition = String(rule.condition) as WorkflowCondition;
        if (!workflowConditions.includes(condition)) return [];
        return [{ condition, ...(typeof rule.amountMinor === "number" ? { amountMinor: rule.amountMinor } : {}) }];
      })
    : workflowConditions.includes(String(config.condition) as WorkflowCondition)
      ? [{ condition: String(config.condition) as WorkflowCondition }]
      : [];
  const operator: WorkflowConditionOperator = config.conditionOperator === "ANY" ? "ANY" : "ALL";
  return { step, rules, operator };
}

export function fanPassesWorkflowEntryGate(steps: StepLike[], fan: ConditionFan) {
  const gate = workflowEntryGate(steps);
  if (!gate) return true;
  return evaluateWorkflowConditionGroup(gate.operator, gate.rules, fan);
}
