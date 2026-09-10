"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Workflow,
} from "lucide-react";

const navigation = [
  ["Dashboard", "/", LayoutDashboard],
  ["Fans", "/fans", Users],
  ["Mensajes", "/messages", MessageSquare],
  ["Plantillas", "/templates", FileText],
  ["Flujos", "/workflows", Workflow],
  ["Automatización", "/automation", Bot],
  ["Analítica", "/analytics", BarChart3],
  ["Configuración", "/settings", Settings],
] as const;

export function SidebarNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="space-y-1">
      {navigation.map(([label, href, Icon]) => {
        const active = href === "/"
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-white/8 font-medium text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}
          >
            <Icon className={`size-4 ${active ? "text-violet-400" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
