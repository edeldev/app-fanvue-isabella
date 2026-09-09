export const workflowTriggers = [
  "MANUAL", "FOLLOW_CREATED", "SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_DEACTIVATED", "RENEWAL_CHANGED", "MESSAGE_RECEIVED", "PRESENCE_ONLINE",
] as const;

export type WorkflowTrigger = (typeof workflowTriggers)[number];

export const workflowTriggerLabels: Record<WorkflowTrigger, string> = {
  MANUAL: "Inicio manual",
  FOLLOW_CREATED: "Nuevo seguidor",
  SUBSCRIPTION_ACTIVATED: "Suscripción activada",
  SUBSCRIPTION_RENEWED: "Suscripción renovada",
  SUBSCRIPTION_DEACTIVATED: "Suscripción desactivada",
  RENEWAL_CHANGED: "Renovación automática modificada",
  MESSAGE_RECEIVED: "Mensaje recibido",
  PRESENCE_ONLINE: "Fan conectado",
};
