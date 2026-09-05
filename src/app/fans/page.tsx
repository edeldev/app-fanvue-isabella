import { cookies } from "next/headers";
import { Search, Users } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusTooltips } from "@/components/status-tooltips";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const subscriptionLabels = {
  ACTIVE: { label: "Activo", description: "Tiene una suscripción activa." },
  CANCEL_AT_PERIOD_END: { label: "Cancela al vencer", description: "Sigue activo hasta terminar el periodo pagado, pero no renovará." },
  PENDING: { label: "Pendiente de precio", description: "Debe aceptar el nuevo precio. Si tiene renovación automática, continúa renovando al precio anterior mientras tanto." },
  PAUSED: { label: "Pausado", description: "La suscripción está temporalmente pausada." },
  EXPIRED: { label: "Vencido", description: "La suscripción terminó, pero el fan todavía puede ser contactable." },
  CANCELLED: { label: "Cancelado", description: "La suscripción fue cancelada y ya no está activa." },
} as const;

export default async function FansPage() {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(cookieStore.get(CREATOR_SESSION_COOKIE)?.value);
  const fans = creatorId ? await prisma.fan.findMany({
    where: { creatorId, isCreatorAccount: false, OR: [{ isFollower: true }, { isSubscriber: true }, { isExpiredSubscriber: true }] }, orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }], take: 100,
    include: { subscriptions: { orderBy: { startedAt: "desc" }, take: 1 }, enrollments: { where: { status: { in: ["ACTIVE", "WAITING", "PAUSED"] } }, include: { workflow: true, currentStep: true }, take: 1 } },
  }) : [];
  const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><LiveRefresh /><StatusTooltips /><Sidebar /><div className="min-w-0 flex-1"><Topbar /><main className="mx-auto max-w-[1500px] px-5 py-8 md:px-8"><div className="mb-8"><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">CRM</p><h1 className="text-3xl font-semibold tracking-tight text-white">Fans</h1><p className="mt-2 text-sm text-zinc-500">Quiénes son, qué hicieron y qué estrategia sigue cada relación.</p></div>
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.035] px-4 py-3 text-zinc-500"><Search className="size-4" /><span className="text-sm">Búsqueda y filtros avanzados estarán disponibles en la siguiente fase del CRM.</span></div>
    <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[.025]"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-600"><tr><th className="px-5 py-4">Fan</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Gastado</th><th className="px-5 py-4">Workflow</th><th className="px-5 py-4">Última actividad</th></tr></thead><tbody>{fans.map(fan => { const subscription = fan.subscriptions[0]; const subscriptionState = subscription ? subscriptionLabels[subscription.status] : null; const enrollment = fan.enrollments[0]; return <tr key={fan.id} className="border-b border-white/5 last:border-0"><td className="px-5 py-4"><p className="font-medium text-zinc-200">{fan.displayName || fan.username || "Sin nombre"}</p><p className="mt-1 text-xs text-zinc-600">@{fan.username || "sin-usuario"}</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{fan.isFollower ? <span title="Te sigue actualmente en Fanvue." className="rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-300">Seguidor</span> : null}{subscriptionState ? <span title={subscriptionState.description} className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">{subscriptionState.label}</span> : fan.isExpiredSubscriber ? <span title="Tuvo una suscripción y todavía es contactable." className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-300">Vencido</span> : null}{fan.isTopSpender ? <span title="Fanvue lo clasifica entre tus fans con mayor gasto histórico." className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-300">VIP</span> : null}</div></td><td className="px-5 py-4 text-zinc-300">{currency.format(fan.totalSpentMinor / 100)}</td><td className="px-5 py-4"><p className="text-zinc-300">{enrollment?.workflow.name ?? "Sin workflow"}</p><p className="mt-1 text-xs text-zinc-600">{enrollment?.currentStep?.name ?? "Sin próxima acción"}</p></td><td className="px-5 py-4 text-zinc-500">{fan.lastActivityAt?.toLocaleString("es-MX") ?? "Sin actividad"}</td></tr>; })}</tbody></table>{fans.length === 0 ? <div className="grid min-h-64 place-items-center text-center"><div><Users className="mx-auto mb-4 size-7 text-zinc-700" /><p className="text-sm text-zinc-300">No hay fans sincronizados</p><p className="mt-1 text-xs text-zinc-600">Conecta y sincroniza Fanvue desde el Dashboard.</p></div></div> : null}</div>
  </main></div></div>;
}
