import { cookies } from "next/headers";
import { CheckCircle2, Clock3, ExternalLink, Settings, ShieldCheck, Unplug } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LocalDateTime } from "@/components/local-date-time";
import { SettingsForm, type GlobalSettingsView } from "@/features/settings/settings-form";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const defaults: GlobalSettingsView = { timezone: "America/Monterrey", sendWindowEnabled: false, sendingWindowStart: "09:00", sendingWindowEnd: "21:00", sendingWindowDays: [0, 1, 2, 3, 4, 5, 6], sendLimitsEnabled: false, maxMessagesPerHour: 30, maxMessagesPerDay: 200, minMinutesBetweenFanMessages: 60, minimumDelaySeconds: 60, maximumRetries: 3, debugMode: false };

export default async function SettingsPage() {
  const now = new Date();
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const [settings, credential, heartbeat] = creatorId ? await Promise.all([
    prisma.settings.findUnique({ where: { creatorId } }),
    prisma.integrationCredential.findUnique({ where: { creatorId_provider: { creatorId, provider: "FANVUE" } }, select: { tokenExpiresAt: true, scopes: true, updatedAt: true } }),
    prisma.schedulerHeartbeat.findUnique({ where: { id: "workflow-cron" } }),
  ]) : [null, null, null];
  const initial: GlobalSettingsView = settings ? { timezone: settings.timezone, sendWindowEnabled: settings.sendWindowEnabled, sendingWindowStart: settings.sendingWindowStart, sendingWindowEnd: settings.sendingWindowEnd, sendingWindowDays: Array.isArray(settings.sendingWindowDays) ? settings.sendingWindowDays.filter((value): value is number => typeof value === "number") : defaults.sendingWindowDays, sendLimitsEnabled: settings.sendLimitsEnabled, maxMessagesPerHour: settings.maxMessagesPerHour, maxMessagesPerDay: settings.maxMessagesPerDay, minMinutesBetweenFanMessages: settings.minMinutesBetweenFanMessages, minimumDelaySeconds: settings.minimumDelaySeconds, maximumRetries: settings.maximumRetries, debugMode: settings.debugMode } : defaults;
  const cronHealthy = Boolean(heartbeat?.lastSucceededAt && now.getTime() - heartbeat.lastSucceededAt.getTime() < 150_000);

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar /><main className="mx-auto max-w-375 px-5 py-8 md:px-8">
    <div className="mb-8"><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Preferencias</p><h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-white"><Settings className="size-7 text-violet-400" />Configuración</h1><p className="mt-2 text-sm text-zinc-500">Defaults globales, conexión y salud de las automatizaciones.</p></div>
    {!creatorId ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6"><Unplug className="size-6 text-amber-300" /><h2 className="mt-3 font-medium text-amber-200">Fanvue no está conectado</h2><p className="mt-1 text-sm text-amber-200/60">Autoriza tu cuenta antes de configurar automatizaciones.</p><a href="/api/auth/fanvue" className="mt-4 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white">Conectar Fanvue</a></div> : <>
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <StatusCard icon={credential ? CheckCircle2 : Unplug} title={credential ? "Fanvue conectado" : "Fanvue requiere autorización"} detail={credential ? `${credential.scopes.length} permisos autorizados · actualizado ${credential.updatedAt.toLocaleDateString("es-MX")}` : "Vuelve a conectar la cuenta para sincronizar y enviar mensajes."} healthy={Boolean(credential)} action={<a href="/api/auth/fanvue" className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200">{credential ? "Renovar permisos" : "Conectar"}<ExternalLink className="size-3" /></a>} />
        <StatusCard icon={cronHealthy ? ShieldCheck : Clock3} title={cronHealthy ? "Scheduler funcionando" : "Scheduler sin señal reciente"} detail={heartbeat?.lastStartedAt ? <>Último ciclo: <LocalDateTime value={heartbeat.lastStartedAt} /></> : "Todavía no hay ejecuciones registradas."} healthy={cronHealthy} action={<a href="/automation" className="text-xs font-medium text-violet-300 hover:text-violet-200">Ver supervisión</a>} />
      </section>
      <SettingsForm initial={initial} />
    </>}
  </main></div></div>;
}

function StatusCard({ icon: Icon, title, detail, healthy, action }: { icon: typeof CheckCircle2; title: string; detail: React.ReactNode; healthy: boolean; action: React.ReactNode }) {
  return <article className={`rounded-2xl border p-5 ${healthy ? "border-emerald-400/15 bg-emerald-400/[.035]" : "border-amber-400/15 bg-amber-400/[.035]"}`}><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${healthy ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}><Icon className="size-5" /></span><div><h2 className="text-sm font-medium text-white">{title}</h2><div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div></div></div>{action}</div></article>;
}
