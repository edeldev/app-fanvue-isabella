import type { WorkflowDefinitionInput } from "./definition";

type Steps = WorkflowDefinitionInput["steps"];

export function clearBackwardWorkflowConnections(steps: Steps): Steps {
  const positions = new Map(steps.map((step, index) => [String(step.config.stepKey), index]));
  return steps.map((step, index) => {
    const config = { ...step.config };
    for (const field of ["nextTargetKey", "trueTargetKey", "falseTargetKey"] as const) {
      const value = typeof config[field] === "string" ? config[field] : null;
      if (value && (positions.get(value) ?? -1) <= index) delete config[field];
    }
    return { ...step, config };
  });
}

export function reorderWorkflowSteps(steps: Steps, from: number, to: number): Steps {
  if (from === to || from < 0 || from >= steps.length || steps[from]?.type === "END") return steps;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  const endIndex = next.findIndex((step) => step.type === "END");
  next.splice(Math.min(Math.max(to, 0), endIndex), 0, moved);
  return clearBackwardWorkflowConnections(next);
}
