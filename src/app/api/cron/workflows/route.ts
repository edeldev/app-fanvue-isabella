import { isCronRequestAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { runDueWorkflowsForAllCreators } from "@/services/automation/workflow-runner";
import { runScheduledCleanup } from "@/services/maintenance/cleanup";
import { logger, sanitizeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET no está configurado." }, { status: 503 });
  }
  if (!isCronRequestAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Cron no autorizado." }, { status: 401 });
  }
  const startedAt = new Date();
  await prisma.schedulerHeartbeat.upsert({
    where: { id: "workflow-cron" },
    create: { id: "workflow-cron", status: "RUNNING", lastStartedAt: startedAt },
    update: { status: "RUNNING", lastStartedAt: startedAt, error: null },
  });
  try {
    const result = await runDueWorkflowsForAllCreators(startedAt);
    const maintenance = await runScheduledCleanup(startedAt);
    const finishedAt = new Date();
    await prisma.schedulerHeartbeat.update({
      where: { id: "workflow-cron" },
      data: { status: "SUCCESS", lastFinishedAt: finishedAt, lastSucceededAt: finishedAt, result: { ...result, maintenance }, error: null },
    });
    return Response.json({ ok: true, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), ...result, maintenance });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = sanitizeErrorMessage(error instanceof Error ? error.message : "Error desconocido");
    await prisma.schedulerHeartbeat.update({
      where: { id: "workflow-cron" },
      data: { status: "FAILED", lastFinishedAt: new Date(), error: `${errorName}: ${errorMessage}`.slice(0, 1000) },
    }).catch(() => undefined);
    logger.error("Workflow cron failed", { errorName });
    return Response.json({ error: "No se pudo ejecutar el ciclo de workflows." }, { status: 500 });
  }
}
