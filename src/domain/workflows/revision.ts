export function editableWorkflowConfig(value: unknown): Record<string, unknown> {
  const config = typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {};
  for (const key of Object.keys(config)) {
    if (key.startsWith("published")) delete config[key];
  }
  return config;
}

export function replaceWorkflowTarget(value: unknown, fromWorkflowId: string, toWorkflowId: string) {
  const config = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  if (!config || config.targetWorkflowId !== fromWorkflowId) return null;
  return { ...config, targetWorkflowId: toWorkflowId };
}
