import { cookies } from "next/headers";
import { Gauge } from "lucide-react";
import Link from "next/link";
import { SidebarNavigation } from "@/components/app-shell/sidebar-navigation";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";

export async function Sidebar() {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(
    cookieStore.get(CREATOR_SESSION_COOKIE)?.value,
  );

  return (
    <>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto overscroll-contain border-r border-violet-400/10 bg-[#0a0b10] px-4 py-5 shadow-[18px_0_60px_rgba(0,0,0,.18)] lg:flex">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,.16),transparent_68%)]" />
      <Link href="/" aria-label="Conocer Fanvue CRM" className="group relative mb-7 flex items-center gap-3 rounded-2xl border border-transparent px-2 py-2 transition hover:border-violet-400/10 hover:bg-violet-400/[.04]">
        <div className="grid size-10 place-items-center rounded-xl border border-violet-300/25 bg-linear-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_0_25px_rgba(139,92,246,.24)] transition group-hover:shadow-[0_0_32px_rgba(168,85,247,.38)]">
          <Gauge className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">Fanvue CRM</p>
          <p className="truncate text-[9px] font-medium uppercase tracking-[.16em] text-violet-300/55">
            Creator OS
          </p>
        </div>
      </Link>
      <div className="relative mb-3 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-zinc-700">Workspace</div>
      <div className="relative"><SidebarNavigation /></div>
      {!creatorId ? (
        <div className="mt-auto rounded-xl border border-amber-400/15 bg-amber-400/5 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-amber-200">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Conexión Fanvue
          </div>
          <p className="mb-3 text-[11px] leading-4 text-zinc-500">
            Autoriza la cuenta creator para sincronizar datos reales.
          </p>
          <a
            href="/api/auth/fanvue"
            className="block rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-zinc-950 hover:bg-zinc-200"
          >
            Conectar Fanvue
          </a>
        </div>
      ) : null}
    </aside>
    <div aria-hidden="true" className="hidden w-64 shrink-0 lg:block" />
    </>
  );
}
