"use client";

import { Bot, Check, ChevronRight, Copy, FileText, HeartHandshake, MessageCircle, Route, Search, ShieldCheck, Sparkles, Target, TrendingUp, UserRoundSearch, Users, X } from "lucide-react";
import Link from "next/link";
import { enqueueSnackbar } from "notistack";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { IntelligenceSegment, SaleReadiness } from "@/domain/ai/fan-intelligence";

export type FanIntelligenceView = {
  id: string;
  fanvueUserId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  segment: IntelligenceSegment;
  valueScore: number;
  potentialScore: number;
  relationshipScore: number;
  readiness: SaleReadiness;
  totalSpentMinor: number;
  purchaseCount: number;
  tipCount: number;
  inboundMessages: number;
  outboundMessages: number;
  isFollower: boolean;
  isSubscriber: boolean;
  isFreeTrialSubscriber: boolean;
  lastActivityAt: string | null;
  lastInboundText: string | null;
  recentSignals: Array<{ key: "BIKINI" | "DRESS" | "LINGERIE" | "NUDE" | "COSPLAY"; label: string; evidence: string; detectedAt: string }>;
  commercialGuard: { code: "REJECTION" | "NOT_NOW" | "BUDGET_CONCERN"; label: string; evidence: string } | null;
  conversationContext: { stage: "PAUSE" | "CONNECTION" | "DISCOVERY" | "OFFER_READY"; reason: string; evidence: string | null };
  interests: string[];
  reasons: string[];
  nextAction: string;
  activeWorkflow: { id: string; name: string; status: string } | null;
};

type FunnelCoverage = { trigger: string; label: string; published: number; description: string };
type TemplateOption = { id: string; name: string; category: string; type: string };
type WorkflowOption = { id: string; name: string; status: string; triggerEvent: string; goalType: string; steps: number };

const segmentMeta: Record<IntelligenceSegment, { label: string; description: string; className: string }> = {
  HIGH_VALUE: { label: "Alto valor", description: "Mayor gasto y compras confirmadas", className: "border-amber-400/25 bg-amber-400/8 text-amber-200" },
  MID_VALUE: { label: "Valor medio", description: "Ya compra; puede aumentar su valor", className: "border-sky-400/25 bg-sky-400/8 text-sky-200" },
  HIGH_POTENTIAL: { label: "Alto potencial", description: "Conversa mucho y todavía compra poco", className: "border-fuchsia-400/25 bg-fuchsia-400/8 text-fuchsia-200" },
  NURTURE: { label: "Construir relación", description: "Aún necesita confianza y contexto", className: "border-violet-400/20 bg-violet-400/8 text-violet-200" },
  AT_RISK: { label: "Reactivar", description: "Relación sin actividad reciente", className: "border-zinc-500/25 bg-zinc-500/8 text-zinc-300" },
};
const segmentOrder: IntelligenceSegment[] = ["HIGH_VALUE", "MID_VALUE", "HIGH_POTENTIAL", "NURTURE", "AT_RISK"];
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });

export function FanIntelligenceDashboard({ fans, funnelCoverage, templates, workflows }: { fans: FanIntelligenceView[]; funnelCoverage: FunnelCoverage[]; templates: TemplateOption[]; workflows: WorkflowOption[] }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<IntelligenceSegment | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState(fans[0]?.id ?? "");
  const [goal, setGoal] = useState<"RELATIONSHIP" | "SUBSCRIPTION" | "PPV">("RELATIONSHIP");
  const filtered = useMemo(() => fans.filter((fan) => {
    const matchesSegment = segment === "ALL" || fan.segment === segment;
    const normalized = query.trim().toLocaleLowerCase("es-MX");
    return matchesSegment && (!normalized || `${fan.displayName} ${fan.username ?? ""}`.toLocaleLowerCase("es-MX").includes(normalized));
  }), [fans, query, segment]);
  const selected = fans.find((fan) => fan.id === selectedId) ?? filtered[0] ?? null;
  const counts = useMemo(() => Object.fromEntries(segmentOrder.map((key) => [key, fans.filter((fan) => fan.segment === key).length])) as Record<IntelligenceSegment, number>, [fans]);

  return <div className="space-y-6">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {segmentOrder.map((key) => {
        const meta = segmentMeta[key];
        return <button key={key} type="button" onClick={() => setSegment(segment === key ? "ALL" : key)} className={`cursor-pointer rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${segment === key ? meta.className : "border-white/8 bg-white/[.025] text-zinc-300 hover:border-white/15"}`}>
          <div className="flex items-center justify-between"><span className="text-xs font-semibold">{meta.label}</span><span className="text-xl font-semibold text-white">{counts[key]}</span></div>
          <p className="mt-2 text-[10px] leading-4 text-zinc-500">{meta.description}</p>
        </button>;
      })}
    </section>

    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,.75fr)]">
      <div className="min-w-0 self-start overflow-hidden rounded-3xl border border-white/8 bg-white/[.025]">
        <div className="border-b border-white/8 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-white">Mapa de oportunidades</h2><p className="mt-1 text-xs text-zinc-500">Puntuaciones explicables; nunca sustituyen tu criterio.</p></div>
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111319] px-3 transition focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-400/10 sm:w-72"><Search className="size-4 text-zinc-600" /><span className="sr-only">Buscar fan</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar fan…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-zinc-700" /></label>
          </div>
          {segment !== "ALL" ? <button type="button" onClick={() => setSegment("ALL")} className="mt-3 cursor-pointer text-[11px] font-medium text-violet-300 hover:text-violet-200">Mostrar todos los segmentos</button> : null}
        </div>
        <div className="overflow-y-auto overscroll-contain xl:max-h-[calc(100dvh-15rem)] xl:min-h-[32rem]">
          {filtered.map((fan) => <FanRow key={fan.id} fan={fan} selected={selected?.id === fan.id} onSelect={() => setSelectedId(fan.id)} />)}
          {!filtered.length ? <div className="p-12 text-center"><UserRoundSearch className="mx-auto size-8 text-zinc-700" /><p className="mt-3 text-sm text-zinc-500">No encontramos fans con estos filtros.</p></div> : null}
        </div>
      </div>
      <aside className="min-w-0 self-start">{selected ? <FanCopilot fan={selected} goal={goal} setGoal={setGoal} templates={templates} workflows={workflows} /> : <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">Selecciona un fan para abrir su copiloto.</div>}</aside>
    </section>

    <section className="rounded-3xl border border-white/8 bg-gradient-to-br from-violet-500/[.07] to-transparent p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-violet-300"><Target className="size-4" /><p className="text-xs font-semibold uppercase tracking-[.16em]">Cobertura automática</p></div><h2 className="mt-2 text-xl font-semibold text-white">Entrada al embudo</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">Los nuevos seguidores y suscriptores solo entran automáticamente cuando existe un flujo publicado para su evento.</p></div><Link href="/workflows" className="rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400">Gestionar workflows</Link></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{funnelCoverage.map((item) => <div key={item.trigger} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/10 p-4"><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${item.published ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{item.published ? <Check className="size-4" /> : <Target className="size-4" />}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-white">{item.label}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${item.published ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{item.published ? `${item.published} publicado${item.published === 1 ? "" : "s"}` : "Sin cubrir"}</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p></div></div>)}</div>
    </section>
  </div>;
}

function FanRow({ fan, selected, onSelect }: { fan: FanIntelligenceView; selected: boolean; onSelect: () => void }) {
  const meta = segmentMeta[fan.segment];
  const nearHighValue = isNearHighValue(fan);
  return <button type="button" onClick={onSelect} className={`grid w-full cursor-pointer gap-4 border-b border-white/6 p-4 text-left transition last:border-0 hover:bg-white/[.035] sm:grid-cols-[minmax(13rem,1fr)_minmax(9rem,.65fr)_minmax(12rem,.9fr)_auto] sm:items-center sm:px-5 ${selected ? "bg-violet-400/[.06]" : ""}`}>
    <div className="flex min-w-0 items-center gap-3">{fan.avatarUrl ? <span className="size-10 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(fan.avatarUrl).slice(1, -1)})` }} /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/5 text-xs font-semibold text-zinc-500">{initials(fan.displayName)}</span>}<div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-200">{fan.displayName}</p><p className="mt-1 truncate text-[10px] text-zinc-600">@{fan.username ?? "sin-usuario"}</p></div></div>
    <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>{nearHighValue ? <span className="mt-1.5 block w-fit rounded-full border border-amber-400/20 bg-amber-400/[.07] px-2 py-1 text-[9px] font-semibold text-amber-200">Próximo a alto valor · faltan {money.format((5_000 - fan.totalSpentMinor) / 100)}</span> : <p className="mt-1.5 text-[10px] text-zinc-600">{readinessLabel(fan.readiness)}</p>}</div>
    <div className="grid grid-cols-3 gap-2"><MiniScore label="Valor" value={fan.valueScore} /><MiniScore label="Potencial" value={fan.potentialScore} /><MiniScore label="Relación" value={fan.relationshipScore} /></div>
    <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><div><p className="text-sm font-semibold text-white">{money.format(fan.totalSpentMinor / 100)}</p><p className="mt-1 text-[10px] text-zinc-600">{fan.inboundMessages} mensajes recibidos</p></div><ChevronRight className="size-4 text-zinc-700 sm:ml-auto sm:mt-2" /></div>
  </button>;
}

function FanCopilot({ fan, goal, setGoal, templates, workflows }: { fan: FanIntelligenceView; goal: "RELATIONSHIP" | "SUBSCRIPTION" | "PPV"; setGoal: (goal: "RELATIONSHIP" | "SUBSCRIPTION" | "PPV") => void; templates: TemplateOption[]; workflows: WorkflowOption[] }) {
  const [preview, setPreview] = useState<"WORKFLOW" | "TEMPLATE" | null>(null);
  const draft = buildDraft(fan, goal);
  const strategy = strategyForFan(fan);
  const matchingWorkflow = findMatchingWorkflow(strategy, workflows);
  const matchingTemplate = findMatchingTemplate(strategy, templates);
  const recommendedTemplates = templates.filter((template) => goal === "PPV" ? template.type.toLocaleUpperCase() === "PPV" : template.type.toLocaleUpperCase() !== "PPV").slice(0, 3);
  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    enqueueSnackbar("Borrador copiado. Revísalo antes de enviarlo.", { variant: "success" });
  }
  const ppvBlocked = Boolean(fan.commercialGuard) || fan.conversationContext.stage !== "OFFER_READY";
  return <div className="min-w-0 space-y-4 overflow-x-hidden xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
    <div className="min-w-0 overflow-hidden rounded-3xl border border-violet-400/15 bg-[#15171e] shadow-2xl shadow-violet-950/10">
      <div className="border-b border-white/8 bg-gradient-to-br from-violet-500/12 to-fuchsia-500/[.03] p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-violet-500 text-white"><Bot className="size-5" /></span><div><p className="text-sm font-semibold text-white">Copiloto de relación</p><p className="mt-0.5 text-[10px] text-violet-200/60">Contexto de {fan.displayName}</p></div></div><span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300"><ShieldCheck className="size-3" />Requiere aprobación</span></div></div>
      <div className="space-y-5 p-5">
        <div><div className="flex items-center justify-between"><p className="text-xs font-semibold text-zinc-300">Siguiente mejor acción</p><span className="text-[10px] text-zinc-600">Confianza {Math.max(fan.relationshipScore, fan.valueScore)}%</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">{fan.nextAction}</p></div>
        <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[.045] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-200"><Route className="size-3.5" />Estrategia recomendada</div>
          <p className="mt-2 text-sm font-semibold text-white">{strategy.workflowName}</p><p className="mt-1 text-[11px] leading-5 text-zinc-500">{strategy.summary}</p>
          {fan.activeWorkflow ? <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/[.05] px-3 py-2"><p className="text-[10px] font-semibold text-sky-200">Ya está en: {fan.activeWorkflow.name}</p><p className="mt-0.5 text-[9px] text-zinc-600">Revisa ese flujo antes de asignar otro para evitar mensajes cruzados.</p></div> : null}
          <ol className="mt-3 space-y-2">{strategy.steps.map((step, index) => <li key={step} className="flex gap-2 text-[10px] leading-4 text-zinc-400"><span className="grid size-4 shrink-0 place-items-center rounded-full bg-violet-400/10 text-[8px] font-bold text-violet-300">{index + 1}</span>{step}</li>)}</ol>
          <div className="mt-4 grid gap-2">
            <ResourceMatch icon={<Route className="size-3.5" />} label="Workflow" recommendation={strategy.workflowName} match={matchingWorkflow ? `${matchingWorkflow.name} · ${matchingWorkflow.status === "PUBLISHED" ? "Publicado" : "Borrador"}` : null} href={matchingWorkflow ? matchingWorkflow.status === "PUBLISHED" ? `/workflows?fan=${encodeURIComponent(fan.id)}&workflow=${encodeURIComponent(matchingWorkflow.id)}` : `/workflows?q=${encodeURIComponent(matchingWorkflow.name)}` : undefined} onPreview={() => setPreview("WORKFLOW")} />
            <ResourceMatch icon={<FileText className="size-3.5" />} label="Plantilla" recommendation={strategy.templateName} match={matchingTemplate?.name ?? null} href={matchingTemplate ? `/templates#template-${matchingTemplate.id}` : undefined} onPreview={() => setPreview("TEMPLATE")} />
          </div>
        </div>
        {fan.commercialGuard ? <div className="rounded-2xl border border-rose-400/15 bg-rose-400/[.045] p-4"><p className="text-xs font-semibold text-rose-200">Pausa comercial: {fan.commercialGuard.label}</p><p className="mt-1 text-[10px] italic leading-4 text-zinc-600">“{fan.commercialGuard.evidence}”</p></div> : null}
        <div className="rounded-2xl border border-white/8 bg-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Lectura de la conversación</p><p className="mt-2 text-xs leading-5 text-zinc-300">{fan.conversationContext.reason}</p>{fan.conversationContext.evidence ? <p className="mt-1 line-clamp-2 text-[10px] italic leading-4 text-zinc-600">“{fan.conversationContext.evidence}”</p> : null}</div>
        <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setGoal("RELATIONSHIP")} className={goalButton(goal === "RELATIONSHIP")}><HeartHandshake className="size-3.5" />Conectar</button><button type="button" disabled={Boolean(fan.commercialGuard)} title={fan.commercialGuard ? "Deshabilitado por una señal comercial negativa reciente" : undefined} onClick={() => setGoal("SUBSCRIPTION")} className={goalButton(goal === "SUBSCRIPTION", Boolean(fan.commercialGuard))}><Users className="size-3.5" />Suscripción</button><button type="button" disabled={ppvBlocked} title={ppvBlocked ? "Primero necesita una preferencia o intención de compra explícita" : undefined} onClick={() => setGoal("PPV")} className={goalButton(goal === "PPV", ppvBlocked)}><TrendingUp className="size-3.5" />PPV</button></div>
        <div className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-300"><Sparkles className="size-3.5" />Borrador contextual</div><p className="text-sm leading-6 text-zinc-300">{draft}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => void copyDraft()} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/5"><Copy className="size-3.5" />Copiar</button><Link href={`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400"><MessageCircle className="size-3.5" />Abrir chat</Link></div></div>
        {fan.interests.length ? <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Señales de los últimos 4 días</p><div className="mt-2 flex flex-wrap gap-2">{fan.interests.map((interest) => <span key={interest} className="rounded-full border border-white/8 bg-white/[.035] px-2.5 py-1 text-[10px] text-zinc-400">{interest}</span>)}</div>{fan.recentSignals[0] ? <p className="mt-2 line-clamp-2 text-[10px] italic leading-4 text-zinc-600">Evidencia: “{fan.recentSignals[0].evidence}”</p> : null}</div> : null}
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Por qué lo recomendamos</p><ul className="mt-2 space-y-2">{fan.reasons.map((reason) => <li key={reason} className="flex gap-2 text-[11px] leading-5 text-zinc-500"><span className="mt-2 size-1 shrink-0 rounded-full bg-violet-400" />{reason}</li>)}</ul></div>
        {recommendedTemplates.length ? <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Plantillas compatibles</p><div className="mt-2 space-y-2">{recommendedTemplates.map((template) => <div key={template.name} className="rounded-xl border border-white/7 bg-white/[.025] px-3 py-2"><p className="truncate text-[11px] text-zinc-300">{template.name}</p><p className="mt-0.5 text-[9px] text-zinc-600">{template.category} · {template.type}</p></div>)}</div></div> : null}
      </div>
    </div>
    <p className="px-2 text-[10px] leading-4 text-zinc-600">La puntuación usa datos observables y no supone emociones. Verifica siempre el contexto antes de vender o enviar contenido de pago.</p>
    {preview ? <RecommendationPreviewModal type={preview} fan={fan} strategy={strategy} onClose={() => setPreview(null)} /> : null}
  </div>;
}

function buildDraft(fan: FanIntelligenceView, goal: "RELATIONSHIP" | "SUBSCRIPTION" | "PPV") {
  const name = fan.displayName.split(/\s+/)[0] || "{{nombre}}";
  if (fan.commercialGuard) return `${name}, gracias por decírmelo. No te preocupes; no te enviaré ninguna oferta ahora 💜`;
  if (goal === "PPV" && fan.conversationContext.stage !== "OFFER_READY") return intentionalMessages(fan)[0].text;
  const interest = fan.interests[0];
  const recentSignal = fan.recentSignals[0];
  if (goal === "PPV") return recentSignal
    ? contextualPpvMessage(name, recentSignal.key)
    : `${name}, guardé algo que prefiero no mostrar completo de entrada 👀 Te enseño primero un pequeño adelanto y tú decides si quieres descubrir el resto.`;
  if (goal === "SUBSCRIPTION") return fan.isFreeTrialSubscriber
    ? `${name}, quiero que aproveches tu prueba para descubrir lo que realmente te gusta. ${interest ? `Como te interesa ${interest}, puedo enseñarte dónde encontrar más contenido así.` : "¿Qué te gustaría explorar antes de que termine?"}`
    : recentSignal
      ? `${name}, me acordé de que te llamó la atención ${interest}. Hay una parte de mi suscripción que sigue justo por ahí 👀 ¿Quieres que te cuente qué incluye?`
      : `${name}, hay una parte de mi contenido que casi nunca enseño fuera de la suscripción 👀 ¿Quieres que te cuente qué incluye antes de decidir?`;
  return intentionalMessages(fan)[0].text;
}

function contextualPpvMessage(name: string, signal: FanIntelligenceView["recentSignals"][number]["key"]) {
  if (signal === "DRESS") return `${name}, ¿recuerdas el vestido que te gustó? Preparé algo que empieza justo con él… pero esta vez no se queda puesto hasta el final 👀 Te dejo primero la vista previa; tú decides si quieres ver el resto 💜`;
  if (signal === "BIKINI") return `${name}, me acordé de que te gustó el bikini 👀 Preparé algo que empieza justo ahí… pero esta vez el bikini no se queda hasta el final. Mira primero el adelanto y dime si quieres descubrir el resto 💜`;
  if (signal === "LINGERIE") return `${name}, me acordé de lo que dijiste sobre la lencería 👀 Elegí algo que empieza sutil… y se vuelve mucho más interesante después de la vista previa. Tú decides si quieres ver el resto 💜`;
  if (signal === "NUDE") return `${name}, me acordé de que te gusta cuando dejo menos a la imaginación 👀 Preparé un adelanto pequeño; lo que sigue es justo la parte que no quise revelar aquí 💜`;
  return `${name}, me acordé de que te gustó el cosplay 👀 Elegí uno que empieza con el personaje… pero la vista previa no revela cómo termina. Tú decides si quieres ver el resto 💜`;
}

type StrategyRecommendation = {
  workflowName: string;
  summary: string;
  goals: string[];
  triggers: string[];
  workflowKeywords: string[];
  templateName: string;
  templateType: "TEXT" | "PPV";
  templateKeywords: string[];
  templateMessageIndex?: number;
  steps: string[];
};
type IntentionalMessage = { intent: string; when: string; avoid: string; text: string };

function intentionalMessages(fan: FanIntelligenceView): IntentionalMessage[] {
  const name = fan.displayName.split(/\s+/)[0] || "{{nombre}}";
  if (fan.commercialGuard) return [{ intent: "Respetar su límite y detener recomendaciones comerciales.", when: "Como única confirmación después de su mensaje", avoid: "ya confirmaste que respetarás su decisión", text: `${name}, gracias por decírmelo. No te preocupes; no te enviaré ninguna oferta ahora 💜` }];
  const interest = fan.interests[0];
  const recentSignal = fan.recentSignals[0];
  const interestReference = interest ? `lo que me contaste sobre ${interest}` : "lo que más disfrutas ver aquí";
  const subscriptionReveal = recentSignal
    ? `${name}, me acordé de que te llamó la atención ${interest}. Hay una parte de mi suscripción que sigue justo por ahí 👀 ¿Quieres que te cuente qué incluye?`
    : `${name}, hay una parte de mi contenido que casi nunca enseño fuera de la suscripción 👀 ¿Quieres que te cuente qué incluye antes de decidir?`;
  const ppvReveal = recentSignal
    ? contextualPpvMessage(name, recentSignal.key)
    : `${name}, elegí una de mis vistas previas favoritas para ti. Mira primero el adelanto… el resto es justo la parte que no quise revelar aquí 👀💜`;
  const discovery: IntentionalMessage = {
    intent: "Conseguir una respuesta auténtica y descubrir una preferencia útil.",
    when: fan.lastInboundText ? "Como continuación natural de una conversación de los últimos 4 días" : "Primer contacto o después de 24 h sin conversación",
    avoid: "ya recibió una pregunta parecida o acaba de responder otro tema",
    text: fan.lastInboundText ? `${name}, me quedé pensando en ${interestReference} 😊 ¿qué parte es la que más te gusta?` : `${name}, gracias por estar aquí 😊 Quiero conocerte de verdad: ¿qué tipo de contenido te gustaría encontrar conmigo?`,
  };
  if (fan.segment === "NURTURE") return [
    discovery,
    { intent: "Demostrar que su respuesta fue escuchada, sin vender.", when: "2–3 días después, solo si respondió", avoid: "no respondió al primer mensaje", text: `${name}, me acordé de ${interestReference}. Estoy preparando cosas nuevas y me dio curiosidad: ¿prefieres algo más espontáneo o más producido?` },
    { intent: "Pedir permiso para explicar la suscripción.", when: recentSignal ? "Después de una señal explícita detectada en los últimos 4 días" : "Como invitación inicial, sin afirmar que ya conversaron", avoid: "respuestas cortas, silencio después de una invitación reciente o rechazo", text: subscriptionReveal },
  ];
  if (fan.segment === "HIGH_POTENTIAL") return [
    discovery,
    { intent: "Entregar valor y comprobar intención antes de cobrar.", when: "Después de que confirme un gusto", avoid: "todavía no conoces ninguna preferencia", text: `${name}, ya entendí mejor lo que te gusta 💜 Puedo enseñarte una pequeña vista previa relacionada con ${interest ?? "eso"}, sin compromiso. ¿Te gustaría verla?` },
    { intent: "Proponer una primera compra de baja fricción con permiso.", when: "Solo después de un sí explícito a la vista previa", avoid: "no pidió verla, está frío o acaba de rechazar una oferta", text: `${name}, elegí esto porque conecta con ${interestReference}. Te dejé la vista previa para que sepas exactamente qué esperar; si te gusta, puedes desbloquear el resto aquí 💜` },
  ];
  if (fan.segment === "MID_VALUE") return [
    {
      intent: fan.lastInboundText ? "Actualizar sus preferencias antes de recomendar otra compra." : "Retomar la relación sin convertir su compra anterior en presión.",
      when: fan.lastInboundText ? "Como continuación de su mensaje reciente" : "Cuando no existe conversación en los últimos 4 días",
      avoid: "ya recibió un seguimiento reciente, pidió espacio o no puedes continuar la conversación manualmente",
      text: fan.lastInboundText
        ? `${name}, me dio gusto leerte 😊 Antes de recomendarte cualquier cosa, tengo curiosidad: ¿qué te gustaría ver de mí ahora?`
        : `${name}, hace tiempo que no hablamos 😊 Me acordé de ti y quise saber cómo estás. Sin ofertas de por medio: ¿qué te gustaría ver más de mí últimamente?`,
    },
    { intent: "Validar una recomendación basada en su historial, sin asumir que quiere comprar.", when: "Después de una respuesta positiva o conversación reciente", avoid: "su última compra fue demasiado reciente o no está respondiendo", text: `${name}, quiero recomendarte algo que realmente valga la pena para ti. Pensando en ${interestReference}, ¿te atrae más algo íntimo y natural o algo más elaborado?` },
    { intent: "Ofrecer un PPV relevante y transparente.", when: "Cuando responda la pregunta y exista contenido que coincida", avoid: "el contenido no coincide con su respuesta", text: `${name}, escogí este contenido por lo que acabas de decirme. Mira primero la vista gratuita; si es tu estilo, el resto está disponible para desbloquear 💜` },
  ];
  if (fan.segment === "HIGH_VALUE") return [
    { intent: "Dar atención 1:1 y actualizar gustos sin convertirlo en campaña.", when: "Conversación individual, nunca como envío masivo", avoid: "no puedes responder personalmente después", text: `${name}, quiero asegurarme de no enviarte cosas genéricas. Últimamente, ¿qué te apetece más ver de mí: algo parecido a ${interest ?? "lo que ya te ha gustado"} o probar algo distinto?` },
    { intent: "Diseñar la recomendación con participación del fan.", when: "Después de conocer su preferencia actual", avoid: "no respondió o pidió espacio", text: `${name}, perfecto, ya tengo una idea mucho más clara. Tengo una opción que encaja con eso; ¿quieres que te enseñe una vista previa antes de prepararte la recomendación completa?` },
    { intent: "Presentar una oferta exclusiva y verificable, no una falsa urgencia.", when: "Después de aceptar la vista previa", avoid: "el contenido no es realmente acorde, ya recibió esta oferta o no mostró interés", text: ppvReveal },
  ];
  return [
    { intent: "Reabrir la relación sin presión comercial.", when: "Después de 30 días o más sin actividad", avoid: "ya recibió una reactivación reciente", text: `${name}, hace tiempo que no hablamos 😊 No vengo a venderte nada; solo quería saber cómo estás y qué te gustaría ver ahora.` },
    { intent: "Descubrir si todavía existe interés.", when: "Solo si responde al reencuentro", avoid: "no respondió", text: `${name}, me alegra leerte. ¿Sigues disfrutando ${interestReference} o han cambiado tus gustos últimamente?` },
    { intent: "Moverlo a una nueva estrategia, no vender inmediatamente.", when: "Después de recuperar una conversación real", avoid: "la conversación continúa fría", text: `${name}, gracias por contármelo. Voy a tenerlo en cuenta para enseñarte solo cosas que realmente encajen contigo 💜` },
  ];
}

function strategyForFan(fan: FanIntelligenceView): StrategyRecommendation {
  if (fan.commercialGuard) return {
    workflowName: "Pausa comercial respetuosa",
    summary: "Existe una señal negativa reciente. Detén ofertas y conserva la relación sin intentar vencer su objeción.",
    goals: [], triggers: ["MESSAGE_RECEIVED", "MANUAL"], workflowKeywords: ["pausa", "respeto", "sin oferta", "relación"],
    templateName: "Confirmar pausa sin oferta", templateType: "TEXT", templateKeywords: ["pausa", "respeto", "sin oferta", "confirmación"], templateMessageIndex: 0,
    steps: ["Confirmar que entendiste su mensaje.", "No enviar PPV, descuentos ni argumentos de venta.", "Mantener cualquier conversación posterior sin presión comercial.", "Reevaluar únicamente si el fan expresa por iniciativa propia un interés nuevo."],
  };
  if (fan.segment === "HIGH_VALUE" && !fan.lastInboundText) return {
    workflowName: "Reconexión VIP personal",
    summary: "Su valor histórico merece atención, pero la conversación está fría. Primero recupera la relación sin enviar ofertas ni PPV.",
    goals: [], triggers: ["MANUAL"], workflowKeywords: ["vip", "reconexión", "relación", "personal"],
    templateName: "Volver a conectar con VIP", templateType: "TEXT", templateKeywords: ["vip", "reconexión", "relación", "personal"], templateMessageIndex: 0,
    steps: ["Saludar de forma personal sin mencionar una compra.", "Preguntar qué le interesa ver actualmente.", "Esperar una respuesta real y conversar manualmente.", "Solo después de detectar una preferencia reciente, pasar a una recomendación PPV."],
  };
  if (fan.segment === "HIGH_VALUE" && fan.recentSignals.length === 0) return {
    workflowName: "Descubrimiento VIP antes de oferta",
    summary: "La conversación ya se recuperó, pero todavía falta una preferencia concreta. Descúbrela antes de seleccionar contenido de pago.",
    goals: [], triggers: ["MESSAGE_RECEIVED", "MANUAL"], workflowKeywords: ["vip", "descubrimiento", "preferencias", "relación"],
    templateName: "Pregunta VIP de preferencias", templateType: "TEXT", templateKeywords: ["vip", "preferencias", "pregunta", "personal"], templateMessageIndex: 0,
    steps: ["Reconocer su respuesta reciente.", "Preguntar qué tipo de contenido le interesa ahora.", "Guardar una señal explícita de la conversación.", "Preparar un PPV únicamente cuando exista contenido que coincida."],
  };
  if (fan.segment === "HIGH_VALUE") return {
    workflowName: "Atención VIP y PPV personalizado",
    summary: "Protege la relación de alto valor y ofrece contenido relacionado con sus intereses, sin saturarlo.",
    goals: ["PPV_PURCHASE", "SPEND_AMOUNT", "ANY_PURCHASE"], triggers: ["MESSAGE_RECEIVED", "MANUAL"], workflowKeywords: ["vip", "ppv", "alto valor", "personalizado"],
    templateName: "Oferta VIP personalizada", templateType: "PPV", templateKeywords: ["vip", "exclusivo", "personalizado", "ppv"],
    steps: ["Abrir con contexto personal y reconocer la relación.", "Confirmar qué contenido le interesa ahora.", "Esperar respuesta y ofrecer un PPV relevante con vista gratuita.", "Si no compra, continuar la relación; no repetir la oferta inmediatamente."],
  };
  if (fan.segment === "MID_VALUE" && !fan.lastInboundText) return {
    workflowName: "Reconexión de cliente",
    summary: "Ya compró antes, pero la conversación está fría. Recupera el contacto sin asumir que quiere volver a comprar.",
    goals: [], triggers: ["MANUAL"], workflowKeywords: ["reconexión", "cliente", "relación", "seguimiento"],
    templateName: "Retomar conversación sin oferta", templateType: "TEXT", templateKeywords: ["reconexión", "cliente", "conversación", "seguimiento"], templateMessageIndex: 0,
    steps: ["Retomar el contacto sin mostrar precio ni contenido bloqueado.", "Preguntar si sus gustos han cambiado.", "Esperar una respuesta y conversar con naturalidad.", "Solo después de una señal reciente, preparar una recomendación relevante."],
  };
  if (fan.segment === "MID_VALUE" && fan.recentSignals.length === 0) return {
    workflowName: "Actualizar preferencias de cliente",
    summary: "Volvió a conversar, pero todavía no existe una preferencia concreta que justifique otra oferta.",
    goals: [], triggers: ["MESSAGE_RECEIVED", "MANUAL"], workflowKeywords: ["preferencias", "cliente", "descubrimiento", "seguimiento"],
    templateName: "Pregunta de preferencia actual", templateType: "TEXT", templateKeywords: ["preferencia", "pregunta", "cliente", "interés"], templateMessageIndex: 0,
    steps: ["Reconocer su mensaje reciente.", "Preguntar qué contenido le interesa actualmente.", "Confirmar una preferencia sin presionar una compra.", "Recomendar un PPV solo cuando el contenido coincida con su respuesta."],
  };
  if (fan.segment === "MID_VALUE") return {
    workflowName: "Escalamiento de valor",
    summary: "Usa lo que ya compró como señal y prepara una siguiente oferta de mayor afinidad, no solo de mayor precio.",
    goals: ["SPEND_AMOUNT", "PPV_PURCHASE", "ANY_PURCHASE"], triggers: ["MESSAGE_RECEIVED", "MANUAL"], workflowKeywords: ["escalamiento", "upsell", "ppv", "valor medio"],
    templateName: "Siguiente contenido recomendado", templateType: "PPV", templateKeywords: ["recomendado", "ppv", "especial", "siguiente"],
    steps: ["Retomar un gusto o compra previa.", "Conversar y validar interés sin enviar precio todavía.", "Presentar una vista gratuita y explicar por qué encaja con él.", "Detener la secuencia si compra o pide no recibir ofertas."],
  };
  if (fan.segment === "HIGH_POTENTIAL" && fan.conversationContext.stage !== "OFFER_READY") return {
    workflowName: fan.conversationContext.stage === "DISCOVERY" ? "Conversación y descubrimiento" : "Construir relación antes de vender",
    summary: fan.conversationContext.stage === "DISCOVERY"
      ? "Conversa contigo, pero el tema actual no demuestra interés en contenido. Conoce sus gustos antes de ofrecer algo."
      : "Todavía no existe suficiente contexto comercial. Primero consigue una conversación auténtica.",
    goals: [], triggers: ["MESSAGE_RECEIVED", "MANUAL"], workflowKeywords: ["conversación", "descubrimiento", "relación", "interés"],
    templateName: "Pregunta natural para conocer gustos", templateType: "TEXT", templateKeywords: ["pregunta", "gustos", "conversación", "interés"], templateMessageIndex: 0,
    steps: ["Continuar el tema actual sin cambiar bruscamente a una venta.", "Hacer una pregunta natural sobre sus gustos.", "Esperar una preferencia explícita relacionada con contenido.", "Solo entonces decidir entre suscripción o PPV."],
  };
  if (fan.segment === "HIGH_POTENTIAL") return {
    workflowName: "Primera oferta desde interés confirmado",
    summary: "Existe una preferencia o intención explícita reciente; presenta una primera oferta relacionada sin romper el tono natural del chat.",
    goals: ["FIRST_PURCHASE", "PAID_SUBSCRIPTION"], triggers: ["MESSAGE_RECEIVED", "FOLLOW_CREATED"], workflowKeywords: ["primera compra", "conversión", "potencial", "seguimiento"],
    templateName: "Primera oferta contextual", templateType: "PPV", templateKeywords: ["primera", "oferta", "contextual", "ppv"],
    steps: ["Confirmar que la señal reciente corresponde al contenido disponible.", "Pedir permiso o introducir una vista previa relevante.", "Mostrar claramente qué es gratuito y qué está bloqueado.", "Detener la oferta si pierde interés, rechaza o pide espacio."],
  };
  if (fan.segment === "AT_RISK") return {
    workflowName: "Reactivación suave",
    summary: "Recupera la conversación con valor y curiosidad; la venta queda para después de una respuesta real.",
    goals: ["ANY_PURCHASE", "PAID_SUBSCRIPTION"], triggers: ["MANUAL", "PRESENCE_ONLINE"], workflowKeywords: ["reactivación", "regreso", "inactivo", "recuperación"],
    templateName: "Reencuentro sin venta", templateType: "TEXT", templateKeywords: ["reencuentro", "reactivación", "extraño", "regreso"],
    steps: ["Saludar sin mencionar una oferta.", "Preguntar por sus preferencias actuales.", "Esperar una respuesta antes de continuar.", "Si recupera interés, moverlo a un flujo de relación o conversión."],
  };
  return {
    workflowName: "Bienvenida y descubrimiento",
    summary: "Construye memoria de gustos primero; después decide si conviene suscripción, PPV o solo continuar conversando.",
    goals: ["PAID_SUBSCRIPTION", "FIRST_PURCHASE"], triggers: ["FOLLOW_CREATED", "SUBSCRIPTION_ACTIVATED"], workflowKeywords: ["bienvenida", "nuevo seguidor", "descubrimiento", "primer contacto"],
    templateName: "Bienvenida con pregunta abierta", templateType: "TEXT", templateKeywords: ["bienvenida", "primer contacto", "gracias", "pregunta"],
    steps: ["Agradecer que llegó sin venderle de inmediato.", "Preguntar qué tipo de contenido disfruta.", "Guardar sus señales y responder de forma personalizada.", "Cuando exista interés, cambiar a la estrategia de conversión adecuada."],
  };
}

function findMatchingWorkflow(strategy: StrategyRecommendation, workflows: WorkflowOption[]) {
  return workflows.map((workflow) => {
    const searchable = workflow.name.toLocaleLowerCase("es-MX");
    const score = (strategy.goals.includes(workflow.goalType) ? 5 : 0)
      + (strategy.triggers.includes(workflow.triggerEvent) ? 3 : 0)
      + strategy.workflowKeywords.filter((keyword) => searchable.includes(keyword)).length * 2
      + (workflow.status === "PUBLISHED" ? 1 : 0);
    return { workflow, score };
  }).filter((candidate) => candidate.score >= 5).sort((a, b) => b.score - a.score)[0]?.workflow ?? null;
}

function findMatchingTemplate(strategy: StrategyRecommendation, templates: TemplateOption[]) {
  return templates.map((template) => {
    const searchable = `${template.name} ${template.category}`.toLocaleLowerCase("es-MX");
    const score = (template.type.toLocaleUpperCase() === strategy.templateType ? 4 : 0)
      + strategy.templateKeywords.filter((keyword) => searchable.includes(keyword)).length * 2;
    return { template, score };
  }).filter((candidate) => candidate.score >= 6).sort((a, b) => b.score - a.score)[0]?.template ?? null;
}

function ResourceMatch({ icon, label, recommendation, match, href, onPreview }: { icon: ReactNode; label: string; recommendation: string; match: string | null; href?: string; onPreview: () => void }) {
  const content = <><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-violet-300">{icon}</span><span className="min-w-0 flex-1 overflow-hidden"><span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{label} recomendado</span><span className="mt-0.5 block truncate text-[11px] text-zinc-300">{recommendation}</span><span className={`mt-1 block break-words text-[9px] leading-4 ${match ? "text-emerald-300" : "text-amber-300"}`}>{match ? `Coincidencia encontrada: ${match}` : "No existe uno compatible · Ver ejemplo"}</span></span><ChevronRight className="size-3.5 shrink-0 text-zinc-700" /></>;
  const className = "flex min-w-0 max-w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-white/8 bg-black/10 p-3 text-left transition hover:border-violet-400/20 hover:bg-violet-400/[.04]";
  return match && href ? <Link href={href} className={className}>{content}</Link> : <button type="button" onClick={onPreview} className={className}>{content}</button>;
}

function RecommendationPreviewModal({ type, fan, strategy, onClose }: { type: "WORKFLOW" | "TEMPLATE"; fan: FanIntelligenceView; strategy: StrategyRecommendation; onClose: () => void }) {
  const isWorkflow = type === "WORKFLOW";
  return createPortal(<div role="dialog" aria-modal="true" aria-labelledby="recommendation-preview-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[300] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
    <div className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/12 bg-[#171920] shadow-2xl shadow-black/70">
      <div className="flex items-start justify-between gap-4 border-b border-white/8 bg-gradient-to-br from-violet-500/10 to-transparent p-5 sm:p-6"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-violet-300">Ejemplo recomendado para {fan.displayName}</p><h2 id="recommendation-preview-title" className="mt-2 text-xl font-semibold text-white">{isWorkflow ? strategy.workflowName : strategy.templateName}</h2><p className="mt-2 text-xs leading-5 text-zinc-500">Todavía no existe en tu biblioteca. Este ejemplo es una guía editable antes de guardarlo.</p></div><button type="button" onClick={onClose} aria-label="Cerrar ejemplo" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/8 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-4" /></button></div>
      <div className="p-5 sm:p-6">{isWorkflow ? <WorkflowBlueprint fan={fan} strategy={strategy} /> : <TemplateBlueprint fan={fan} strategy={strategy} />}</div>
      <div className="flex flex-col-reverse gap-2 border-t border-white/8 bg-black/10 p-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:bg-white/5 hover:text-white">Seguir revisando</button><Link href={isWorkflow ? "/workflows?new=1" : "/templates#new-template"} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400">{isWorkflow ? <Route className="size-3.5" /> : <FileText className="size-3.5" />}Vamos a crearlo</Link></div>
    </div>
  </div>, document.body);
}

function WorkflowBlueprint({ fan, strategy }: { fan: FanIntelligenceView; strategy: StrategyRecommendation }) {
  const trigger = readableTrigger(strategy.triggers[0]);
  const messages = intentionalMessages(fan);
  return <div><div className="grid gap-3 sm:grid-cols-2"><BlueprintFact label="Disparador sugerido" value={trigger} /><BlueprintFact label="Objetivo de conversión" value={readableGoal(strategy.goals[0])} /></div><div className="mt-5"><p className="text-xs font-semibold text-zinc-300">Estructura de ejemplo</p><div className="mt-3 space-y-2"><FlowNode index={1} type="Disparador" title={trigger} detail="El fan entra una sola vez y se valida que no tenga otro flujo principal incompatible." />{messages.map((message, index) => <IntentionalMessageNode key={`${message.intent}-${index}`} index={index + 2} message={message} />)}<FlowNode index={messages.length + 2} type="Finalizar" title="Cerrar al convertir o terminar la secuencia" detail="Detener mensajes cuando alcance el objetivo, compre o solicite no recibir más ofertas." /></div></div><div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[.045] p-4 text-[11px] leading-5 text-zinc-500"><strong className="text-amber-200">Configuración sugerida:</strong> pausar cuando el fan responda, reanudar después de 30 minutos sin mensajes y volver a validar interés, compra y suscripción antes de cualquier PPV.</div></div>;
}

function TemplateBlueprint({ fan, strategy }: { fan: FanIntelligenceView; strategy: StrategyRecommendation }) {
  const messages = intentionalMessages(fan);
  const example = strategy.templateMessageIndex === undefined
    ? messages.at(-1)!
    : messages[strategy.templateMessageIndex] ?? messages[0];
  return <div><div className="grid gap-3 sm:grid-cols-2"><BlueprintFact label="Tipo" value={strategy.templateType === "PPV" ? "PPV con vista gratuita" : "Mensaje de texto"} /><BlueprintFact label="Intención" value={example.intent} /><BlueprintFact label="Enviar cuando" value={example.when} /><BlueprintFact label="No enviar cuando" value={example.avoid} /></div><div className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-5"><div className="flex items-center gap-2 text-xs font-semibold text-violet-300"><Sparkles className="size-3.5" />Mensaje exclusivo sugerido</div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{example.text}</p>{strategy.templateType === "PPV" ? <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.04] p-3"><p className="text-[10px] font-semibold text-emerald-200">Vista gratuita</p><p className="mt-1 text-[10px] text-zinc-600">Debe anticipar el tema que el fan confirmó, no una imagen genérica reutilizada.</p></div><div className="rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-3"><p className="text-[10px] font-semibold text-amber-200">Contenido bloqueado</p><p className="mt-1 text-[10px] text-zinc-600">Contenido coherente con la conversación y un precio proporcional a su historial confirmado.</p></div></div> : null}</div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-white/8 px-2.5 py-1 text-[10px] text-zinc-500">Personalizar con {"{{nombre}}"}</span>{fan.interests[0] ? <span className="rounded-full border border-white/8 px-2.5 py-1 text-[10px] text-zinc-500">Interés real: {fan.interests[0]}</span> : <span className="rounded-full border border-amber-400/15 px-2.5 py-1 text-[10px] text-amber-300">Falta descubrir un interés</span>}<span className="rounded-full border border-white/8 px-2.5 py-1 text-[10px] text-zinc-500">Revisar antes de enviar</span></div></div>;
}

function BlueprintFact({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-2 text-xs leading-5 text-zinc-300">{value}</p></div>; }
function FlowNode({ index, type, title, detail }: { index: number; type: string; title: string; detail: string }) { return <div className="flex gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-[10px] font-bold text-violet-300">{index}</span><div><p className="text-[9px] font-semibold uppercase tracking-wider text-violet-300/70">{type}</p><p className="mt-1 text-xs font-medium text-zinc-300">{title}</p><p className="mt-1 text-[10px] leading-4 text-zinc-600">{detail}</p></div></div>; }
function IntentionalMessageNode({ index, message }: { index: number; message: IntentionalMessage }) { return <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-[10px] font-bold text-violet-300">{index}</span><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className="text-[9px] font-semibold uppercase tracking-wider text-violet-300/70">Enviar mensaje</span><span className="text-[9px] text-zinc-700">· {message.when}</span></div><p className="mt-1 text-xs font-medium text-zinc-300">Intención: {message.intent}</p><p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-[11px] leading-5 text-zinc-400">“{message.text}”</p><p className="mt-2 text-[9px] text-amber-300/70">Evitar si: {message.avoid}</p></div></div></div>; }
function readableTrigger(trigger: string) { return ({ FOLLOW_CREATED: "Nuevo seguidor", SUBSCRIPTION_ACTIVATED: "Suscripción activada", MESSAGE_RECEIVED: "Mensaje recibido", PRESENCE_ONLINE: "Fan conectado", MANUAL: "Asignación manual" } as Record<string, string>)[trigger] ?? trigger; }
function readableGoal(goal: string) { return ({ FIRST_PURCHASE: "Primera compra", PAID_SUBSCRIPTION: "Suscripción de pago", PPV_PURCHASE: "Compra de PPV", SPEND_AMOUNT: "Alcanzar un monto de gasto", ANY_PURCHASE: "Cualquier compra" } as Record<string, string>)[goal] ?? goal; }

function goalButton(active: boolean, disabled = false) {
  return `flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-medium transition ${disabled ? "cursor-not-allowed border-white/5 bg-white/[.015] text-zinc-700 opacity-60" : active ? "cursor-pointer border-violet-400/30 bg-violet-500/15 text-violet-200" : "cursor-pointer border-white/8 bg-white/[.025] text-zinc-500 hover:text-zinc-300"}`;
}
function MiniScore({ label, value }: { label: string; value: number }) { return <div><div className="h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-violet-400" style={{ width: `${value}%` }} /></div><p className="mt-1 text-[9px] text-zinc-600">{label} {value}</p></div>; }
function readinessLabel(readiness: SaleReadiness) { return readiness === "HOT" ? "Momento activo" : readiness === "WARM" ? "Interés reciente" : "Sin señal reciente"; }
function isNearHighValue(fan: FanIntelligenceView) { return fan.segment === "MID_VALUE" && fan.totalSpentMinor >= 3_000 && fan.totalSpentMinor < 5_000 && Math.max(fan.potentialScore, fan.relationshipScore) >= 70; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "F"; }
