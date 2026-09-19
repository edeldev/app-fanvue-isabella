import { cookies } from "next/headers";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  Clock3,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
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
import { prioritizeFanAttention } from "@/domain/ai/attention-priority";

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
    attentionCandidates,
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
        settings: { select: { timezone: true } },
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
    prisma.fan.findMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        OR: [
          { isFollower: true },
          { isSubscriber: true },
          { isFreeTrialSubscriber: true },
          { isExpiredSubscriber: true },
        ],
      },
      select: {
        id: true,
        fanvueUserId: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        totalSpentMinor: true,
        lastActivityAt: true,
        isSubscriber: true,
        isFreeTrialSubscriber: true,
        isNonRenewingSubscriber: true,
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 1,
          select: {
            unreadMessagesCount: true,
            lastMessageAt: true,
            lastInboundAt: true,
            lastOutboundAt: true,
            messages: {
              where: { deletedAt: null },
              orderBy: { sentAt: "desc" },
              take: 20,
              select: { direction: true },
            },
          },
        },
        subscriptions: {
          where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
          orderBy: { currentPeriodEndsAt: "asc" },
          take: 1,
          select: { currentPeriodEndsAt: true, isFreeTrial: true },
        },
      },
      orderBy: [{ lastActivityAt: "desc" }, { totalSpentMinor: "desc" }],
      take: 250,
    }),
    prisma.automationLog.findMany({
      where: { creatorId },
      orderBy: { occurredAt: "desc" },
      take: 6,
      select: { id: true, explanation: true, occurredAt: true },
    }),
  ]);
  const attention = attentionCandidates
    .flatMap((fan) => {
      const conversation = fan.conversations[0];
      const messages = conversation?.messages ?? [];
      const recommendation = prioritizeFanAttention({
        unreadMessages: conversation?.unreadMessagesCount ?? 0,
        totalSpentMinor: fan.totalSpentMinor,
        inboundMessages: messages.filter((message) => message.direction === "INBOUND").length,
        outboundMessages: messages.filter((message) => message.direction === "OUTBOUND").length,
        lastInboundAt: conversation?.lastInboundAt ?? null,
        lastOutboundAt: conversation?.lastOutboundAt ?? null,
        lastActivityAt: fan.lastActivityAt ?? conversation?.lastMessageAt ?? null,
        isSubscriber: fan.isSubscriber,
        isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
        isNonRenewingSubscriber: fan.isNonRenewingSubscriber,
        trialEndsAt: fan.subscriptions[0]?.isFreeTrial
          ? fan.subscriptions[0].currentPeriodEndsAt
          : null,
      }, new Date(), creator?.settings?.timezone || "America/Monterrey");
      return recommendation ? [{
        ...recommendation,
        id: fan.id,
        fanvueUserId: fan.fanvueUserId,
        name: fan.displayName || fan.username || "Fan sin nombre",
        username: fan.username,
        avatarUrl: fan.avatarUrl,
        totalSpentMinor: fan.totalSpentMinor,
      }] : [];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return {
    creator,
    fans: creator?.fanvueContactsCount ?? fans,
    followers: creator?.fanvueFollowersCount ?? followers,
    subscribers: creator?.fanvueSubscribersCount ?? subscribers,
    additionalExpiredSubscribers,
    workflows,
    pendingMessages: pendingMessages._sum.unreadMessagesCount ?? 0,
    revenue: revenue._sum.amountMinor ?? creator?.allTimeEarningsMinor ?? 0,
    attention,
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
          <section className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-white/[.035]">
            <div className="flex flex-col gap-3 border-b border-white/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-violet-300" />
                  <h2 className="font-medium text-white">Atención prioritaria</h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Hasta 10 conversaciones donde actuar ahora puede marcar una diferencia.
                </p>
              </div>
              <Link href="/intelligence" className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-300 transition hover:text-violet-200">
                Ver IA de fans <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            {data?.attention.length ? (
              <div className="divide-y divide-white/6">
                {data.attention.map((fan) => {
                  const initials = fan.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                  const priority = {
                    URGENT: { label: "Responder ahora", className: "border-rose-400/20 bg-rose-400/8 text-rose-200" },
                    TODAY: { label: "Atender hoy", className: "border-amber-400/20 bg-amber-400/8 text-amber-200" },
                    SOON: { label: "Oportunidad", className: "border-violet-400/20 bg-violet-400/8 text-violet-200" },
                  }[fan.priority];
                  return (
                    <Link
                      key={fan.id}
                      href={`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}`}
                      className="group grid gap-3 px-5 py-4 transition hover:bg-white/[.035] sm:grid-cols-[minmax(0,1fr)_minmax(16rem,.8fr)_auto] sm:items-center md:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-500/12 text-xs font-semibold text-violet-200">
                          {fan.avatarUrl ? <span className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }} /> : initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">{fan.name}</p>
                          <p className="truncate text-xs text-zinc-600">@{fan.username || "sin-usuario"} · ${(fan.totalSpentMinor / 100).toFixed(2)} USD</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-300">{fan.reason}</p>
                        <p className="mt-1 truncate text-xs text-zinc-600">{fan.action}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priority.className}`}>{priority.label}</span>
                        <ArrowUpRight className="size-4 text-zinc-700 transition group-hover:text-violet-300" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-40 place-items-center px-6 py-8 text-center">
                <div>
                  <Clock3 className="mx-auto size-5 text-emerald-400" />
                  <p className="mt-3 text-sm font-medium text-zinc-200">No hay casos urgentes ahora</p>
                  <p className="mt-1 text-xs text-zinc-600">La bandeja se llenará con señales reales, no con urgencias inventadas.</p>
                </div>
              </div>
            )}
          </section>
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
