import { isCronRequestAuthorized } from "@/lib/cron-auth";
import { runDueWorkflowsForAllCreators } from "@/services/automation/workflow-runner";

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
  try {
    const result = await runDueWorkflowsForAllCreators(startedAt);
    return Response.json({ ok: true, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), ...result });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "Workflow cron failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ error: "No se pudo ejecutar el ciclo de workflows." }, { status: 500 });
  }
}
