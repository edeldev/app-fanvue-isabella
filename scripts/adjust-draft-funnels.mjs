import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function onlyDraft(name) {
  const records = await prisma.workflow.findMany({
    where: { name },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (records.length !== 1 || records[0].status !== "DRAFT") {
    throw new Error(`Se esperaba exactamente un borrador llamado «${name}».`);
  }
  return records[0];
}

async function insertCondition(workflow, position, key, conditions) {
  if (workflow.steps.some((item) => item.config?.stepKey === key)) return false;
  const target = workflow.steps.find((item) => item.position === position);
  const end = workflow.steps.at(-1);
  if (!target || end?.type !== "END") throw new Error(`Estructura inesperada en ${workflow.name}.`);
  const targetKey = target.config?.stepKey;
  const endKey = end.config?.stepKey;
  if (typeof targetKey !== "string" || typeof endKey !== "string") throw new Error("Faltan referencias de pasos.");
  const previous = workflow.steps.find((item) => item.position === position - 1);
  const config = {
    stepKey: key,
    conditions: conditions.map((condition) => ({ condition })),
    conditionOperator: "ALL",
    trueTargetKey: targetKey,
    falseTargetKey: endKey,
  };
  if (!apply) return true;
  await prisma.$transaction(async (tx) => {
    await tx.workflowStep.updateMany({ where: { workflowId: workflow.id, position: { gte: position } }, data: { position: { increment: 100 } } });
    await tx.workflowStep.updateMany({ where: { workflowId: workflow.id, position: { gte: position + 100 } }, data: { position: { decrement: 99 } } });
    await tx.workflowStep.create({ data: { workflowId: workflow.id, position, name: "Comprobar estado actual", type: "CONDITION", config } });
    if (previous && typeof previous.config === "object" && previous.config !== null && !Array.isArray(previous.config) && typeof previous.config.nextTargetKey === "string") {
      await tx.workflowStep.update({ where: { id: previous.id }, data: { config: { ...previous.config, nextTargetKey: key } } });
    }
  }, { timeout: 60_000, maxWait: 15_000 });
  return true;
}

async function main() {
  const follower = await onlyDraft("NUEVOS SEGUIDORES");
  if (follower.triggerEvent !== "FOLLOW_CREATED") throw new Error("El flujo de seguidores no usa el disparador esperado.");
  const changedFollower = await insertCondition(follower, 0, "guard-follower-before-welcome", ["IS_FOLLOWER", "IS_NOT_SUBSCRIBER"]);
  console.log(`Nuevos seguidores: ${changedFollower ? "añadir comprobación antes de la bienvenida" : "comprobación inicial ya presente"}.`);

  const subscriber = await onlyDraft("NUEVOS SUSCRIPTORES");
  if (subscriber.triggerEvent !== "MANUAL" && subscriber.triggerEvent !== "SUBSCRIPTION_ACTIVATED") throw new Error("Disparador inesperado en nuevos suscriptores.");
  if (apply) await prisma.workflow.update({ where: { id: subscriber.id }, data: { triggerEvent: "SUBSCRIPTION_ACTIVATED", priority: 200 } });
  const changedSubscriber = await insertCondition(subscriber, 0, "guard-active-subscriber-before-gift", ["IS_SUBSCRIBER"]);
  console.log(`Nuevos suscriptores: activación automática, prioridad 200; ${changedSubscriber ? "añadir comprobación de acceso" : "comprobación ya presente"}.`);

  const expired = await onlyDraft("SUSCRIPCION DESACTIVADA");
  if (expired.triggerEvent !== "SUBSCRIPTION_DEACTIVATED") throw new Error("Disparador inesperado en suscripción desactivada.");
  if (apply) await prisma.workflow.update({ where: { id: expired.id }, data: { priority: 250, reentryPolicy: "ONCE", reentryDelayDays: null } });
  const changedExpired = await insertCondition(expired, 1, "guard-still-expired-before-reminder", ["IS_EXPIRED_SUBSCRIBER", "IS_NOT_SUBSCRIBER"]);
  console.log(`Suscripción desactivada: prioridad 250, solo una vez por fan; ${changedExpired ? "añadir comprobación tras la espera" : "comprobación ya presente"}.`);

  const returned = await onlyDraft("SE HA VUELTO A SUSCRIBIR - DE PAGO - DINERO REAL");
  if (returned.triggerEvent !== "MANUAL" && returned.triggerEvent !== "SUBSCRIPTION_REACTIVATED") throw new Error("Disparador inesperado en resuscripción.");
  if (!returned.steps.some((item) => item.type === "CONDITION" && JSON.stringify(item.config).includes("IS_PAID_SUBSCRIBER"))) throw new Error("El regalo de regreso no tiene la comprobación de suscripción de pago.");
  if (apply) await prisma.workflow.update({ where: { id: returned.id }, data: { triggerEvent: "SUBSCRIPTION_REACTIVATED", priority: 300, reentryPolicy: "ONCE", reentryDelayDays: null } });
  console.log("Regreso con pago: disparador de resuscripción, prioridad 300 y regalo solo una vez por fan tras comprobar suscripción de pago.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
