import { cookies } from "next/headers";
import { ExternalLink, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import { WorkflowAlertsMenu } from "./workflow-alerts-menu";
import { MobileNavigation } from "./mobile-navigation";
import { GlobalSearch } from "./global-search";
import { TopbarDropdownCoordinator } from "./topbar-dropdown-coordinator";
import { EngagementNotificationsMenu } from "@/components/notifications/engagement-notifications-menu";

export async function Topbar() {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(
    cookieStore.get(CREATOR_SESSION_COOKIE)?.value,
  );
  const [creator, alertRecords, unreadAlertCount] = creatorId
    ? await Promise.all([prisma.creator.findUnique({
        where: { id: creatorId },
        select: {
          displayName: true,
          username: true,
          avatarUrl: true,
        },
      }), prisma.automationLog.findMany({
        where: { creatorId, level: "ERROR", eventType: { in: ["WORKFLOW_STEP_FAILED", "WORKFLOW_FAILED"] } },
        orderBy: { occurredAt: "desc" },
        take: 8,
        select: {
          id: true, explanation: true, reasonCode: true, occurredAt: true, reviewedAt: true,
          fan: { select: { displayName: true, username: true } },
          enrollment: { select: { workflow: { select: { name: true } } } },
        },
      }), prisma.automationLog.count({
        where: { creatorId, level: "ERROR", eventType: { in: ["WORKFLOW_STEP_FAILED", "WORKFLOW_FAILED"] }, reviewedAt: null },
      })])
    : [null, [], 0];
  const alerts = alertRecords.map((alert) => ({
    id: alert.id,
    explanation: alert.explanation,
    reasonCode: alert.reasonCode,
    occurredAt: alert.occurredAt.toISOString(),
    reviewed: alert.reviewedAt !== null,
    fanName: alert.fan?.displayName || alert.fan?.username || null,
    workflowName: alert.enrollment?.workflow.name || null,
  }));
  const initials = (creator?.displayName || creator?.username || "CR")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header data-topbar className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between gap-2 border-b border-violet-400/10 bg-[#0e1016]/88 px-3 shadow-[0_14px_45px_rgba(0,0,0,.16)] backdrop-blur-2xl sm:gap-3 sm:px-5 md:px-8">
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />
      <TopbarDropdownCoordinator />
      <div className="relative flex min-w-0 flex-1 items-center gap-2 text-zinc-500 sm:gap-3">
        <MobileNavigation />
        <GlobalSearch />
      </div>
      <div className="relative flex items-center gap-1.5 sm:gap-2">
        {creator ? <EngagementNotificationsMenu /> : null}
        {creator ? <WorkflowAlertsMenu alerts={alerts} unreadCount={unreadAlertCount} /> : null}
        {creator ? (
          <details className="group relative">
            <summary
              aria-label="Abrir perfil de creador"
              className="grid size-10 cursor-pointer list-none place-items-center overflow-hidden rounded-xl border border-violet-300/25 bg-linear-to-br from-violet-400 to-fuchsia-600 text-xs font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,.16)] ring-violet-400/15 transition hover:shadow-[0_0_30px_rgba(168,85,247,.28)] hover:ring-4 [&::-webkit-details-marker]:hidden"
            >
              {creator.avatarUrl ? (
                <span
                  className="size-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${JSON.stringify(creator.avatarUrl).slice(1, -1)})`,
                  }}
                />
              ) : (
                initials
              )}
            </summary>
            <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.35rem] border border-violet-400/15 bg-[#15171f]/98 p-4 shadow-[0_24px_80px_rgba(0,0,0,.68),0_0_40px_rgba(139,92,246,.08)] backdrop-blur-2xl">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-300/60 to-transparent" />
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-violet-300/20 bg-linear-to-br from-violet-400 to-fuchsia-600 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,.18)]">
                  {creator.avatarUrl ? (
                    <span
                      className="size-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${JSON.stringify(creator.avatarUrl).slice(1, -1)})`,
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {creator.displayName || "Creador de Fanvue"}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    @{creator.username || "sin-usuario"}
                  </p>
                </div>
              </div>
              <a
                href={`https://www.fanvue.com/${creator?.username}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,.12)] transition hover:bg-violet-400"
              >
                Ir a mi cuenta de Fanvue
                <ExternalLink className="size-4" />
              </a>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-200"
                >
                  Cerrar sesión
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </details>
        ) : (
          <a
            href="/api/auth/fanvue"
            className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400"
          >
            Conectar
          </a>
        )}
      </div>
    </header>
  );
}
