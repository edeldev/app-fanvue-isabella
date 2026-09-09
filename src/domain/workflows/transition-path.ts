export function extendWorkflowPath(value: unknown, currentWorkflowId: string, targetWorkflowId: string) {
  const existing = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [currentWorkflowId];
  if (!existing.includes(currentWorkflowId)) existing.push(currentWorkflowId);
  if (existing.includes(targetWorkflowId)) throw new Error("WORKFLOW_CHANGE_CYCLE_DETECTED");
  return [...existing, targetWorkflowId];
}
