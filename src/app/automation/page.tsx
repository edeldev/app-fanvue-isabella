import { cookies } from "next/headers";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, TimerReset } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalDateTime } from "@/components/local-date-time";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { FailureRecoveryActions } from "@/features/automation/failure-recovery-actions";

const heartbeatId = "workflow-cron";
const healthyThresholdMs = 150_000;

export default async function AutomationPage() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const now = new Date();
  const [heartbeat, waiting, paused, retrying, failed, nextEnrollment, recentFailures] = creatorId
    ? await Promise.all([
        prisma.schedulerHeartbeat.findUnique({ where: { id: heartbeatId } }),
        prisma.workflowEnrollment.count({ where: { creatorId, status: "WAITING" } }),
        prisma.workflowEnrollment.count({ where: { creatorId, status: "PAUSED" } }),
        prisma.automationExecution.count({ where: { creatorId, status: "RETRYING" } }),
        prisma.workflowEnrollment.count({ where: { creatorId, status: "FAILED" } }),
        prisma.workflowEnrollment.findFirst({
          where: { creatorId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] }, nextRunAt: { not: null } },
          orderBy: { nextRunAt: "asc" },
          select: {
            nextRunAt: true,
            fan: { select: { displayName: true, username: true } },
            workflow: { select: { name: true } },
            currentStep: { select: { name: true } },
          },
        }),
        prisma.automationExecution.findMany({
          where: { creatorId, status: "FAILED" },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true, reason: true, reasonCode: true, updatedAt: true,
            fan: { select: { displayName: true, username: true } },
            enrollment: { select: { id: true, workflow: { select: { name: true } } } },
            step: { select: { name: true } },
          },
        }),
      ])
    : [null, 0, 0, 0, 0, null, []];

  const heartbeatAge = heartbeat ? now.getTime() - heartbeat.lastStartedAt.getTime() : Number.POSITIVE_INFINITY;
  const cronState = !heartbeat
    ? "NEVER"
    : heartbeat.status === "FAILED"
      ? "FAILED"
      : heartbeatAge <= healthyThresholdMs
        ? "HEALTHY"
        : "DELAYED";
  const cronPresentation = {
    HEALTHY: { label: "Cron funcionando", detail: "Supabase está contactando al scheduler cada minuto.", tone: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300", icon: CheckCircle2 },
    FAILED: { label: "Último ciclo falló", detail: "El cron llegó a la aplicación, pero el procesamiento terminó con error.", tone: "border-red-400/20 bg-red-400/8 text-red-300", icon: AlertTriangle },
    DELAYED: { label: "Cron sin señal reciente", detail: "No se ha registrado un ciclo durante más de dos minutos y medio.", tone: "border-amber-400/20 bg-amber-400/8 text-amber-300", icon: AlertTriangle },
    NEVER: { label: "Esperando primera señal", detail: "Todavía no se ha registrado una ejecución del cron después de este despliegue.", tone: "border-zinc-400/15 bg-white/[.025] text-zinc-400", icon: Clock3 },
  }[cronState];
  const CronIcon = cronPresentation.icon;

  return (
    <div className="flex min-h-screen bg-[#101218] text-zinc-100">
      <LiveRefresh intervalMs={30_000} />
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-375 px-4 py-6 sm:px-5 sm:py-8 md:px-8">
          <div className="mb-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Automatización</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Supervisión del scheduler</h1>
            <p className="mt-2 text-sm text-zinc-500">Estado real del cron, trabajos programados, reintentos y fallos.</p>
          </div>

          {!creatorId ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-amber-200">Conecta Fanvue para supervisar las automatizaciones.</div> : <>
            <section className={`rounded-2xl border p-5 ${cronPresentation.tone}`}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/15"><CronIcon className={`size-5 ${heartbeat?.status === "RUNNING" ? "animate-spin" : ""}`} /></span>
                  <div><h2 className="font-semibold">{cronPresentation.label}</h2><p className="mt-1 text-xs opacity-70">{cronPresentation.detail}</p></div>
                </div>
                <div className="text-left text-xs opacity-75 sm:text-right"><p>Último ciclo</p><p className="mt-1 font-medium text-current">{heartbeat ? <LocalDateTime value={heartbeat.lastStartedAt} /> : "Sin registros"}</p></div>
              </div>
              {heartbeat?.error ? <p className="mt-4 rounded-xl bg-black/15 px-4 py-3 font-mono text-[11px]">{heartbeat.error}</p> : null}
            </section>

            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={Clock3} label="En espera" value={waiting} detail="Con una acción programada" />
              <Metric icon={TimerReset} label="Pausados" value={paused} detail="Manuales o por respuesta" />
              <Metric icon={RefreshCw} label="Reintentando" value={retrying} detail="Fallos temporales" />
              <Metric icon={AlertTriangle} label="Fallidos" value={failed} detail="Requieren revisión" danger={failed > 0} />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
              <article className="rounded-2xl border border-white/8 bg-white/[.035] p-5">
                <div className="flex items-center gap-2"><Clock3 className="size-4 text-violet-400" /><h2 className="font-medium text-white">Próxima ejecución</h2></div>
                {nextEnrollment?.nextRunAt ? <div className="mt-5">
                  <p className="text-xl font-semibold text-white"><LocalDateTime value={nextEnrollment.nextRunAt} /></p>
                  <p className="mt-3 text-sm text-zinc-400">{nextEnrollment.workflow.name}</p>
                  <p className="mt-1 text-xs text-zinc-600">{nextEnrollment.fan.displayName || nextEnrollment.fan.username || "Fan sin nombre"}{nextEnrollment.currentStep ? ` · ${nextEnrollment.currentStep.name}` : ""}</p>
                </div> : <p className="mt-5 text-sm text-zinc-600">No hay acciones programadas.</p>}
              </article>

              <article className="rounded-2xl border border-white/8 bg-white/[.035] p-5">
                <div className="flex items-center gap-2"><Activity className="size-4 text-violet-400" /><div><h2 className="font-medium text-white">Fallos recientes</h2><p className="mt-0.5 text-xs text-zinc-600">Últimos intentos que agotaron sus reintentos</p></div></div>
                {recentFailures.length ? <div className="mt-4 space-y-2">{recentFailures.map((failure) => <div key={failure.id} className="rounded-xl border border-red-400/10 bg-red-400/[.025] p-3">
                  <div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="text-xs text-zinc-300">{failure.enrollment.workflow.name} · {failure.step.name}</p><span className="text-[10px] text-zinc-600"><LocalDateTime value={failure.updatedAt} /></span></div>
                  <p className="mt-1 text-[11px] text-zinc-500">{failure.fan.displayName || failure.fan.username || "Fan sin nombre"}{failure.reasonCode ? ` · ${failure.reasonCode}` : ""}</p>
                  {failure.reason ? <p className="mt-2 text-[11px] text-red-300/70">{failure.reason}</p> : null}
                  <FailureRecoveryActions enrollmentId={failure.enrollment.id} workflowName={failure.enrollment.workflow.name} stepName={failure.step.name} />
                </div>)}</div> : <div className="mt-5 flex items-center gap-2 text-sm text-emerald-300/70"><CheckCircle2 className="size-4" /> No hay ejecuciones fallidas.</div>}
              </article>
            </section>
          </>}
        </main>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, danger = false }: { icon: typeof Clock3; label: string; value: number; detail: string; danger?: boolean }) {
  return <article className={`rounded-2xl border bg-white/[.035] p-5 ${danger ? "border-red-400/20" : "border-white/8"}`}>
    <div className="flex items-center justify-between"><p className="text-xs font-medium text-zinc-500">{label}</p><Icon className={`size-4 ${danger ? "text-red-400" : "text-zinc-600"}`} /></div>
    <p className={`mt-3 text-3xl font-semibold ${danger ? "text-red-300" : "text-white"}`}>{value}</p><p className="mt-1 text-[11px] text-zinc-600">{detail}</p>
  </article>;
}
