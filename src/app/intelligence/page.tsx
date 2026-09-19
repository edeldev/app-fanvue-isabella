import { BrainCircuit, LockKeyhole, Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { extractConversationInterests, scoreFanIntelligence } from "@/domain/ai/fan-intelligence";
import { FanIntelligenceDashboard, type FanIntelligenceView } from "@/features/ai/fan-intelligence-dashboard";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export default async function IntelligencePage() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const [records, workflows, templates] = creatorId ? await Promise.all([
    prisma.fan.findMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        OR: [{ isFollower: true }, { isSubscriber: true }, { isFreeTrialSubscriber: true }, { isExpiredSubscriber: true }],
      },
      include: {
        purchases: {
          where: { reversedAt: null, amountMinor: { gt: 0 } },
          select: { amountMinor: true, source: true, purchasedAt: true },
          orderBy: { purchasedAt: "desc" },
        },
        conversations: {
          take: 1,
          orderBy: { lastMessageAt: "desc" },
          include: {
            messages: {
              where: { deletedAt: null },
              orderBy: { sentAt: "desc" },
              take: 50,
              select: { direction: true, text: true, sentAt: true },
            },
          },
        },
        enrollments: {
          where: { status: { in: ["ACTIVE", "WAITING", "PAUSED"] } },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { status: true, workflow: { select: { id: true, name: true } } },
        },
      },
      take: 500,
    }),
    prisma.workflow.findMany({
      where: { creatorId, status: { in: ["PUBLISHED", "DRAFT"] } },
      select: { id: true, name: true, status: true, triggerEvent: true, goalType: true, _count: { select: { steps: true } } },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.messageTemplate.findMany({
      where: { creatorId, status: "ACTIVE" },
      select: { id: true, name: true, category: true, type: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]) : [[], [], []];

  const fans: FanIntelligenceView[] = records.map((fan) => {
    const messages = fan.conversations[0]?.messages ?? [];
    const inbound = messages.filter((message) => message.direction === "INBOUND");
    const outbound = messages.filter((message) => message.direction === "OUTBOUND");
    const intelligence = scoreFanIntelligence({
      totalSpentMinor: fan.totalSpentMinor,
      purchaseCount: fan.purchases.length,
      tipCount: fan.purchases.filter((purchase) => purchase.source.toLocaleLowerCase() === "tip").length,
      inboundMessages: inbound.length,
      outboundMessages: outbound.length,
      lastInboundAt: inbound[0]?.sentAt ?? fan.conversations[0]?.lastInboundAt ?? null,
      lastActivityAt: fan.lastActivityAt,
      isFollower: fan.isFollower,
      isSubscriber: fan.isSubscriber,
      isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
      isAutoRenewingSubscriber: fan.isAutoRenewingSubscriber,
    });
    return {
      id: fan.id,
      fanvueUserId: fan.fanvueUserId,
      displayName: fan.displayName || fan.username || "Fan sin nombre",
      username: fan.username,
      avatarUrl: fan.avatarUrl,
      ...intelligence,
      totalSpentMinor: fan.totalSpentMinor,
      purchaseCount: fan.purchases.length,
      tipCount: fan.purchases.filter((purchase) => purchase.source.toLocaleLowerCase() === "tip").length,
      inboundMessages: inbound.length,
      outboundMessages: outbound.length,
      isFollower: fan.isFollower,
      isSubscriber: fan.isSubscriber,
      isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
      lastActivityAt: fan.lastActivityAt?.toISOString() ?? null,
      lastInboundText: inbound.find((message) => message.text?.trim())?.text?.trim() ?? null,
      interests: extractConversationInterests(inbound.flatMap((message) => message.text ? [message.text] : [])),
      activeWorkflow: fan.enrollments[0] ? { id: fan.enrollments[0].workflow.id, name: fan.enrollments[0].workflow.name, status: fan.enrollments[0].status } : null,
    };
  }).sort((a, b) => segmentWeight(b.segment) - segmentWeight(a.segment) || Math.max(b.valueScore, b.potentialScore) - Math.max(a.valueScore, a.potentialScore));
  const triggerCounts = new Map<string, number>();
  workflows.filter((workflow) => workflow.status === "PUBLISHED").forEach((workflow) => triggerCounts.set(workflow.triggerEvent, (triggerCounts.get(workflow.triggerEvent) ?? 0) + 1));
  const funnelCoverage = [
    { trigger: "FOLLOW_CREATED", label: "Nuevos seguidores", published: triggerCounts.get("FOLLOW_CREATED") ?? 0, description: "Agradece el follow, conoce sus intereses y construye confianza antes de vender." },
    { trigger: "SUBSCRIPTION_ACTIVATED", label: "Nuevos suscriptores", published: triggerCounts.get("SUBSCRIPTION_ACTIVATED") ?? 0, description: "Da la bienvenida, entrega valor y adapta los siguientes mensajes a su actividad." },
  ];

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100">
    <Sidebar />
    <div className="min-w-0 flex-1"><Topbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1580px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 text-violet-400"><BrainCircuit className="size-4" /><p className="text-xs font-medium uppercase tracking-[.18em]">Inteligencia de relación</p></div><h1 className="text-3xl font-semibold tracking-tight text-white">IA de fans</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Prioriza relaciones con datos reales, entiende el contexto y prepara el siguiente mensaje sin convertir la conversación en spam.</p></div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-4 py-3"><LockKeyhole className="size-4 text-emerald-300" /><div><p className="text-xs font-semibold text-emerald-200">Modo copiloto</p><p className="mt-0.5 text-[10px] text-zinc-600">Nunca envía ni cobra sin aprobación</p></div></div>
        </div>
        {!creatorId ? <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><Sparkles className="mx-auto size-8 text-violet-400" /><h2 className="mt-3 font-semibold text-white">Conecta Fanvue para analizar tus relaciones</h2><a href="/api/auth/fanvue" className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white">Conectar Fanvue</a></div> : <FanIntelligenceDashboard fans={fans} funnelCoverage={funnelCoverage} templates={templates} workflows={workflows.map((workflow) => ({ id: workflow.id, name: workflow.name, status: workflow.status, triggerEvent: workflow.triggerEvent, goalType: workflow.goalType, steps: workflow._count.steps }))} />}
      </main>
    </div>
  </div>;
}

function segmentWeight(segment: FanIntelligenceView["segment"]) {
  return { HIGH_VALUE: 5, MID_VALUE: 4, HIGH_POTENTIAL: 3, NURTURE: 2, AT_RISK: 1 }[segment];
}
