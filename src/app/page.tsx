import { cookies } from "next/headers";
import {
  Activity,
  Bot,
  CircleDollarSign,
  MessageSquare,
  Users,
} from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { LiveRefresh } from "@/components/live-refresh";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import { SyncFanvueButton } from "@/components/sync-fanvue-button";

async function dashboardData(creatorId: string | null) {
  if (!creatorId) return null;
  const [
    creator,
    fans,
    followers,
    subscribers,
    additionalExpiredSubscribers,
    workflows,
    pendingMessages,
    revenue,
    logs,
  ] = await Promise.all([
    prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        displayName: true,
        allTimeEarningsMinor: true,
        fanvueFollowersCount: true,
        fanvueSubscribersCount: true,
        fanvueContactsCount: true,
      },
    }),
    prisma.fan.count({
      where: {
        creatorId,
        isCreatorAccount: false,
        OR: [
          { isFollower: true },
          { isSubscriber: true },
          { isExpiredSubscriber: true },
        ],
      },
    }),
    prisma.fan.count({ where: { creatorId, isFollower: true } }),
    prisma.fan.count({
      where: { creatorId, isSubscriber: true, isCreatorAccount: false },
    }),
    prisma.fan.count({
      where: {
        creatorId,
        isExpiredSubscriber: true,
        isFollower: false,
        isSubscriber: false,
        isCreatorAccount: false,
      },
    }),
    prisma.workflowEnrollment.count({
      where: { creatorId, status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
    }),
    prisma.conversation.aggregate({
      where: {
        creatorId,
        fan: {
          isCreatorAccount: false,
          OR: [
            { isFollower: true },
            { isSubscriber: true },
            { isExpiredSubscriber: true },
          ],
        },
      },
      _sum: { unreadMessagesCount: true },
    }),
    prisma.purchase.aggregate({
      where: { creatorId, amountMinor: { gt: 0 } },
      _sum: { amountMinor: true },
    }),
    prisma.automationLog.findMany({
      where: { creatorId },
      orderBy: { occurredAt: "desc" },
      take: 6,
      select: { id: true, explanation: true, occurredAt: true },
    }),
  ]);
  return {
    creator,
    fans: creator?.fanvueContactsCount ?? fans,
    followers: creator?.fanvueFollowersCount ?? followers,
    subscribers: creator?.fanvueSubscribersCount ?? subscribers,
    additionalExpiredSubscribers,
    workflows,
    pendingMessages: pendingMessages._sum.unreadMessagesCount ?? 0,
    revenue: revenue._sum.amountMinor ?? creator?.allTimeEarningsMinor ?? 0,
    logs,
  };
}

export default async function Home() {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(
    cookieStore.get(CREATOR_SESSION_COOKIE)?.value,
  );
  const data = await dashboardData(creatorId);
  const money = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
  }).format((data?.revenue ?? 0) / 100);

  return (
    <div className="flex min-h-screen bg-[#101218] text-zinc-100">
      <LiveRefresh />
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-375 px-4 py-6 sm:px-5 sm:py-8 md:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">
                Centro de control
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Resumen de relaciones
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Observa, evalúa, valida, actúa y comprende cada decisión.
              </p>
            </div>
            {data ? (
              <SyncFanvueButton />
            ) : (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/8 px-3 py-1.5 text-xs text-amber-200">
                Fanvue sin conectar
              </span>
            )}
          </div>
          <section
            aria-label="Indicadores principales"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <StatCard
              label="Fans contactables"
              value={data ? String(data.fans) : "—"}
              detail={
                data
                  ? `${data.followers} seguidores · ${data.subscribers} suscriptores · ${data.additionalExpiredSubscribers} vencidos adicionales`
                  : "Sin datos sincronizados"
              }
              icon={Users}
            />
            <StatCard
              label="Ganancias totales"
              value={data ? money : "—"}
              detail="Ingresos brutos de todo el tiempo en Fanvue"
              icon={CircleDollarSign}
            />
            <StatCard
              label="Flujos activos"
              value={String(data?.workflows ?? 0)}
              detail="Incluye activos, en espera y pausados"
              icon={Bot}
            />
            <StatCard
              label="Mensajes pendientes"
              value={data ? String(data.pendingMessages) : "—"}
              detail="Sin leer, solo de fans contactables; excluye creadores"
              icon={MessageSquare}
            />
          </section>
          {data ? (
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              <span className="font-medium text-zinc-400">
                ¿Por qué no coincide la suma?
              </span>{" "}
              “Fans totales” muestra contactos únicos de las listas de
              seguidores, suscriptores y vencidos que entrega la API. Excluye
              cuentas creadoras; las categorías pueden superponerse.
            </p>
          ) : null}
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="min-h-80 rounded-2xl border border-white/8 bg-white/[.035] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-white">Actividad reciente</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Eventos verificados y decisiones de automatización
                  </p>
                </div>
                <Activity className="size-4 text-zinc-600" />
              </div>
              {data?.logs.length ? (
                <div className="mt-6 space-y-4">
                  {data.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-3 border-b border-white/5 pb-4"
                    >
                      <span className="mt-1.5 size-2 rounded-full bg-violet-400" />
                      <div>
                        <p className="text-sm text-zinc-300">
                          {log.explanation}
                        </p>
                        <time className="mt-1 block text-xs text-zinc-600">
                          {log.occurredAt.toLocaleString("es-MX")}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center text-center">
                  <div>
                    <Activity className="mx-auto mb-4 size-6 text-zinc-600" />
                    <p className="text-sm font-medium text-zinc-300">
                      Sin actividad todavía
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Sincroniza Fanvue para importar información real.
                    </p>
                  </div>
                </div>
              )}
            </article>
            <article className="rounded-2xl border border-white/8 bg-linear-to-b from-violet-500/8 to-transparent p-6">
              <p className="text-xs font-medium uppercase tracking-[.16em] text-violet-300">
                Principio del sistema
              </p>
              <h2 className="mt-5 text-xl font-medium text-white">
                Programado no significa enviar.
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Cada acción vuelve a cargar el estado del fan y pasa por
                Validation Guard antes de producir efectos.
              </p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
