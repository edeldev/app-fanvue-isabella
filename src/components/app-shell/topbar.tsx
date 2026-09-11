import { cookies } from "next/headers";
import { ExternalLink, LogOut, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import { WorkflowAlertsMenu } from "./workflow-alerts-menu";
import { MobileNavigation } from "./mobile-navigation";

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
    <header className="relative z-30 flex h-16 items-center justify-between border-b border-white/8 bg-[#101218]/85 px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-3 text-zinc-500">
        <MobileNavigation />
        <Search className="size-4" />
        <span className="hidden text-sm sm:inline">
          Buscar fans, mensajes y workflows…
        </span>
      </div>
      <div className="flex items-center gap-3">
        {creator ? <WorkflowAlertsMenu alerts={alerts} unreadCount={unreadAlertCount} /> : null}
        {creator ? (
          <details className="group relative">
            <summary
              aria-label="Abrir perfil de creador"
              className="grid size-10 cursor-pointer list-none place-items-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-violet-400 to-fuchsia-600 text-xs font-semibold text-white ring-violet-400/30 transition hover:ring-4 [&::-webkit-details-marker]:hidden"
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
            <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#181a21] p-4 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-600 text-sm font-semibold text-white">
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
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
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
