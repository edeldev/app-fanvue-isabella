"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BrainCircuit,
  CalendarClock,
  ContactRound,
  Bot,
  FileText,
  Images,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Workflow,
} from "lucide-react";

const navigation = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Fans", "/fans", Users],
  ["Fan Lifecycle", "/lifecycle", ContactRound],
  ["Mensajes", "/messages", MessageSquare],
  ["Content Library", "/content-library", Images],
  ["Content Studio", "/content-planner", CalendarClock],
  ["Plantillas", "/templates", FileText],
  ["Flujos", "/workflows", Workflow],
  ["Automatización", "/automation", Bot],
  ["IA de fans", "/intelligence", BrainCircuit],
  ["Analítica", "/analytics", BarChart3],
  ["Configuración", "/settings", Settings],
] as const;

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="space-y-1.5">
      {navigation.map(([label, href, Icon]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm transition duration-200 ${active ? "border-violet-400/20 bg-violet-500/10 font-medium text-white shadow-[inset_0_0_24px_rgba(139,92,246,.035),0_0_24px_rgba(139,92,246,.05)]" : "border-transparent text-zinc-500 hover:border-white/[.06] hover:bg-white/[.035] hover:text-zinc-100"}`}
          >
            {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,.9)]" /> : null}
            <span className={`grid size-7 shrink-0 place-items-center rounded-lg transition ${active ? "bg-violet-400/10 text-violet-200" : "text-zinc-600 group-hover:text-violet-300"}`}>
              <Icon className="size-4" />
            </span>
            <span className="truncate">{label}</span>
            {active ? <span className="ml-auto size-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,.9)]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
