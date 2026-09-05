export interface WorkflowCandidate {
  id: string;
  priority: number;
  version: number;
}

export function resolveHighestPriority<T extends WorkflowCandidate>(candidates: readonly T[]): T | null {
  return [...candidates].sort((left, right) =>
    right.priority - left.priority || right.version - left.version || left.id.localeCompare(right.id),
  )[0] ?? null;
}
