import { cookies } from "next/headers";
import { Bell, ExternalLink, LogOut, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";

export async function Topbar() {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(
    cookieStore.get(CREATOR_SESSION_COOKIE)?.value,
  );
  const creator = creatorId
    ? await prisma.creator.findUnique({
        where: { id: creatorId },
        select: {
          displayName: true,
          username: true,
          avatarUrl: true,
        },
      })
    : null;
  const initials = (creator?.displayName || creator?.username || "CR")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="relative z-30 flex h-16 items-center justify-between border-b border-white/8 bg-[#101218]/85 px-5 md:px-8">
      <div className="flex items-center gap-3 text-zinc-500">
        <Search className="size-4" />
        <span className="hidden text-sm sm:inline">
          Buscar fans, mensajes y workflows…
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          aria-label="Notificaciones"
          className="grid size-9 place-items-center rounded-lg border border-white/8 text-zinc-400"
        >
          <Bell className="size-4" />
        </button>
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
            <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#181a21] p-4 shadow-2xl shadow-black/50">
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
