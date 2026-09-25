import { BrainCircuit, LockKeyhole, Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/app-shell/sidebar";
import { IntelligenceLiveRefresh } from "@/components/intelligence-live-refresh";
import { Topbar } from "@/components/app-shell/topbar";
import { analyzeConversationContext, detectCommercialGuard, detectRecentConversationSignals, scoreFanIntelligence } from "@/domain/ai/fan-intelligence";
import { calculateNextBestAction } from "@/domain/ai/next-best-action";
import { FanIntelligenceDashboard, type FanIntelligenceView } from "@/features/ai/fan-intelligence-dashboard";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

type IntelligenceRange = "7" | "30" | "90" | "all";

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ aiRange?: string | string[]; fan?: string | string[] }> }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const resolvedSearchParams = await searchParams;
  const requestedRange = resolvedSearchParams.aiRange;
  const requestedFan = Array.isArray(resolvedSearchParams.fan) ? resolvedSearchParams.fan[0] : resolvedSearchParams.fan;
  const range: IntelligenceRange = typeof requestedRange === "string" && ["7", "30", "90", "all"].includes(requestedRange) ? requestedRange as IntelligenceRange : "30";
  const now = new Date();
  const contextCutoff = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1_000);
  const memoryCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const analyticsCutoff = range === "all" ? null : new Date(now.getTime() - Number(range) * 24 * 60 * 60 * 1_000);
  const messageCutoff = analyticsCutoff && analyticsCutoff < memoryCutoff ? analyticsCutoff : memoryCutoff;
  const [records, workflows, templates] = creatorId ? await Promise.all([
    prisma.fan.findMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        OR: [
          { isFollower: true },
          { isSubscriber: true },
          { isFreeTrialSubscriber: true },
          { isExpiredSubscriber: true },
          ...(requestedFan ? [{ id: requestedFan }, { fanvueUserId: requestedFan }] : []),
        ],
      },
      include: {
        purchases: {
          where: { reversedAt: null, amountMinor: { gt: 0 } },
          select: { amountMinor: true, source: true, purchasedAt: true },
          orderBy: { purchasedAt: "desc" },
        },
        subscriptions: {
          select: { startedAt: true, isFreeTrial: true, amountPaidMinor: true },
          orderBy: { startedAt: "desc" },
        },
        conversations: {
          take: 1,
          orderBy: { lastMessageAt: "desc" },
          include: {
            messages: {
              where: { deletedAt: null, ...(range === "all" ? {} : { sentAt: { gte: messageCutoff } }) },
              orderBy: { sentAt: "desc" },
              take: range === "all" ? 500 : 250,
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
        automationLogs: {
          where: { eventType: { in: ["AI_RECOMMENDATION_USED", "AI_RECOMMENDATION_HELPFUL", "AI_RECOMMENDATION_REJECTED"] }, ...(analyticsCutoff ? { occurredAt: { gte: analyticsCutoff } } : {}) },
          orderBy: { occurredAt: "desc" },
          take: range === "all" ? 500 : 250,
          select: { id: true, eventType: true, explanation: true, metadata: true, occurredAt: true },
        },
        memories: {
          where: { status: "ACTIVE" },
          select: { category: true, key: true, value: true, evidence: true, confidence: true },
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
    const recentInbound = inbound.filter((message) => message.sentAt >= contextCutoff);
    const recentSignals = detectRecentConversationSignals(recentInbound, now);
    const commercialGuard = detectCommercialGuard(recentInbound);
    const conversationContext = analyzeConversationContext(recentInbound, recentSignals, commercialGuard);
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
    const plan = calculateNextBestAction({
      name: fan.displayName?.split(/\s+/)[0] || fan.username || "Hola",
      lifecycleStage: fan.lifecycleStage,
      isFollower: fan.isFollower,
      isSubscriber: fan.isSubscriber,
      isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
      totalSpentMinor: fan.totalSpentMinor,
      inboundMessages: inbound.length,
      lastInboundAt: inbound[0]?.sentAt ?? fan.conversations[0]?.lastInboundAt ?? null,
      lastOutboundAt: outbound[0]?.sentAt ?? fan.conversations[0]?.lastOutboundAt ?? null,
      hasActiveWorkflow: Boolean(fan.enrollments[0]),
      memories: fan.memories,
    });
    return {
      id: fan.id,
      fanvueUserId: fan.fanvueUserId,
      displayName: fan.displayName || fan.username || "Fan sin nombre",
      username: fan.username,
      avatarUrl: fan.avatarUrl,
      ...intelligence,
      plan,
      totalSpentMinor: fan.totalSpentMinor,
      purchaseCount: fan.purchases.length,
      tipCount: fan.purchases.filter((purchase) => purchase.source.toLocaleLowerCase() === "tip").length,
      inboundMessages: inbound.length,
      outboundMessages: outbound.length,
      isFollower: fan.isFollower,
      isSubscriber: fan.isSubscriber,
      isFreeTrialSubscriber: fan.isFreeTrialSubscriber,
      lastActivityAt: fan.lastActivityAt?.toISOString() ?? null,
      lastInboundText: recentInbound.find((message) => message.text?.trim())?.text?.trim() ?? null,
      recentSignals: recentSignals.map((signal) => ({
        key: signal.key,
        label: signal.label,
        evidence: signal.evidence,
        detectedAt: signal.detectedAt.toISOString(),
      })),
      commercialGuard,
      conversationContext,
      interests: recentSignals.map((signal) => signal.label),
      recentRecommendationTexts: [...new Set([
        ...outbound.flatMap((message) => message.text?.trim() ? [message.text.trim()] : []),
        ...fan.automationLogs.flatMap((log) => recommendationText(log.metadata)),
      ])].slice(0, 100),
      recommendationHistory: fan.automationLogs.map((log) => {
        const metadata = recommendationMetadata(log.metadata);
        const outcomeDeadline = new Date(log.occurredAt.getTime() + 7 * 24 * 60 * 60 * 1_000);
        const reply = inbound
          .filter((message) => message.sentAt > log.occurredAt && message.sentAt <= outcomeDeadline)
          .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())[0];
        const purchase = fan.purchases
          .filter((item) => item.purchasedAt > log.occurredAt && item.purchasedAt <= outcomeDeadline)
          .sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime())[0];
        const subscription = fan.subscriptions
          .filter((item) => item.startedAt > log.occurredAt && item.startedAt <= outcomeDeadline)
          .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())[0];
        return {
          id: log.id,
          action: recommendationAction(log.eventType),
          goal: metadata.goal,
          text: metadata.text,
          reason: metadata.reason,
          occurredAt: log.occurredAt.toISOString(),
          observedOutcomes: {
            replied: Boolean(reply),
            purchased: Boolean(purchase),
            subscribed: Boolean(subscription),
            revenueMinor: purchase?.amountMinor ?? 0,
          },
          outcome: purchase
            ? { type: "PURCHASE" as const, occurredAt: purchase.purchasedAt.toISOString(), amountMinor: purchase.amountMinor, isFreeTrial: false }
            : subscription
              ? { type: "SUBSCRIPTION" as const, occurredAt: subscription.startedAt.toISOString(), amountMinor: subscription.amountPaidMinor ?? 0, isFreeTrial: subscription.isFreeTrial }
              : reply
                ? { type: "REPLY" as const, occurredAt: reply.sentAt.toISOString(), amountMinor: 0, isFreeTrial: false }
                : null,
        };
      }),
      activeWorkflow: fan.enrollments[0] ? { id: fan.enrollments[0].workflow.id, name: fan.enrollments[0].workflow.name, status: fan.enrollments[0].status } : null,
    };
  }).sort((a, b) => planWeight(b.plan.kind) - planWeight(a.plan.kind) || segmentWeight(b.segment) - segmentWeight(a.segment) || Math.max(b.valueScore, b.potentialScore) - Math.max(a.valueScore, a.potentialScore));
  const triggerCounts = new Map<string, number>();
  workflows.filter((workflow) => workflow.status === "PUBLISHED").forEach((workflow) => triggerCounts.set(workflow.triggerEvent, (triggerCounts.get(workflow.triggerEvent) ?? 0) + 1));
  const funnelCoverage = [
    { trigger: "FOLLOW_CREATED", label: "Nuevos seguidores", published: triggerCounts.get("FOLLOW_CREATED") ?? 0, description: "Agradece el follow, conoce sus intereses y construye confianza antes de vender." },
    { trigger: "SUBSCRIPTION_ACTIVATED", label: "Nuevos suscriptores", published: triggerCounts.get("SUBSCRIPTION_ACTIVATED") ?? 0, description: "Da la bienvenida, entrega valor y adapta los siguientes mensajes a su actividad." },
  ];

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100">
    <IntelligenceLiveRefresh />
    <Sidebar />
    <div className="min-w-0 flex-1"><Topbar />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1580px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 text-violet-400"><BrainCircuit className="size-4" /><p className="text-xs font-medium uppercase tracking-[.18em]">Inteligencia de relación</p></div><h1 className="text-3xl font-semibold tracking-tight text-white">IA de fans</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Prioriza relaciones con datos reales, entiende el contexto y prepara el siguiente mensaje sin convertir la conversación en spam.</p></div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] px-4 py-3"><LockKeyhole className="size-4 text-emerald-300" /><div><p className="text-xs font-semibold text-emerald-200">Modo copiloto</p><p className="mt-0.5 text-[10px] text-zinc-600">Nunca envía ni cobra sin aprobación</p></div></div>
        </div>
        {!creatorId ? <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><Sparkles className="mx-auto size-8 text-violet-400" /><h2 className="mt-3 font-semibold text-white">Conecta Fanvue para analizar tus relaciones</h2><a href="/api/auth/fanvue" className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white">Conectar Fanvue</a></div> : <FanIntelligenceDashboard fans={fans} initialFanId={requestedFan} analyticsRange={range} funnelCoverage={funnelCoverage} templates={templates} workflows={workflows.map((workflow) => ({ id: workflow.id, name: workflow.name, status: workflow.status, triggerEvent: workflow.triggerEvent, goalType: workflow.goalType, steps: workflow._count.steps }))} />}
      </main>
    </div>
  </div>;
}

function recommendationText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const text = (metadata as Record<string, unknown>).text;
  return typeof text === "string" && text.trim() ? [text.trim()] : [];
}

function recommendationMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return { text: "Recomendación sin texto disponible", goal: "RELATIONSHIP", reason: null };
  const value = metadata as Record<string, unknown>;
  return {
    text: typeof value.text === "string" ? value.text : "Recomendación sin texto disponible",
    goal: typeof value.goal === "string" ? value.goal : "RELATIONSHIP",
    reason: typeof value.reason === "string" ? value.reason : null,
  };
}

function recommendationAction(eventType: string) {
  if (eventType === "AI_RECOMMENDATION_HELPFUL") return "HELPFUL" as const;
  if (eventType === "AI_RECOMMENDATION_REJECTED") return "NOT_HELPFUL" as const;
  return "COPIED" as const;
}

function segmentWeight(segment: FanIntelligenceView["segment"]) {
  return { HIGH_VALUE: 5, MID_VALUE: 4, HIGH_POTENTIAL: 3, NURTURE: 2, AT_RISK: 1 }[segment];
}

function planWeight(kind: FanIntelligenceView["plan"]["kind"]) {
  return { REPLY: 8, RETENTION: 7, FIRST_CONTACT: 6, REACTIVATION: 5, PPV: 4, SUBSCRIPTION: 3, DISCOVER: 2, WAIT: 1 }[kind];
}
