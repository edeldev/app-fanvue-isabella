import { cookies } from "next/headers";
import { Gauge } from "lucide-react";
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
    <aside className="hidden w-64 shrink-0 border-r border-white/8 bg-[#0b0d12] px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start lg:flex-col lg:overflow-y-auto">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white">
          <Gauge className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Fanvue CRM</p>
          <p className="text-[11px] text-zinc-500">
            Plataforma de automatización
          </p>
        </div>
      </div>
      <SidebarNavigation />
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
  );
}
