"use client";

import { Bot, Check, ChevronRight, Copy, HeartHandshake, MessageCircle, Search, ShieldCheck, Sparkles, Target, TrendingUp, UserRoundSearch, Users } from "lucide-react";
import Link from "next/link";
import { enqueueSnackbar } from "notistack";
import { useMemo, useState } from "react";
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
  interests: string[];
  reasons: string[];
  nextAction: string;
};

type FunnelCoverage = { trigger: string; label: string; published: number; description: string };
type TemplateOption = { name: string; category: string; type: string };

const segmentMeta: Record<IntelligenceSegment, { label: string; description: string; className: string }> = {
  HIGH_VALUE: { label: "Alto valor", description: "Mayor gasto y compras confirmadas", className: "border-amber-400/25 bg-amber-400/8 text-amber-200" },
  MID_VALUE: { label: "Valor medio", description: "Ya compra; puede aumentar su valor", className: "border-sky-400/25 bg-sky-400/8 text-sky-200" },
  HIGH_POTENTIAL: { label: "Alto potencial", description: "Conversa mucho y todavía compra poco", className: "border-fuchsia-400/25 bg-fuchsia-400/8 text-fuchsia-200" },
  NURTURE: { label: "Construir relación", description: "Aún necesita confianza y contexto", className: "border-violet-400/20 bg-violet-400/8 text-violet-200" },
  AT_RISK: { label: "Reactivar", description: "Relación sin actividad reciente", className: "border-zinc-500/25 bg-zinc-500/8 text-zinc-300" },
};
const segmentOrder: IntelligenceSegment[] = ["HIGH_VALUE", "MID_VALUE", "HIGH_POTENTIAL", "NURTURE", "AT_RISK"];
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });

export function FanIntelligenceDashboard({ fans, funnelCoverage, templates }: { fans: FanIntelligenceView[]; funnelCoverage: FunnelCoverage[]; templates: TemplateOption[] }) {
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

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,.75fr)]">
      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[.025]">
        <div className="border-b border-white/8 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-white">Mapa de oportunidades</h2><p className="mt-1 text-xs text-zinc-500">Puntuaciones explicables; nunca sustituyen tu criterio.</p></div>
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111319] px-3 transition focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-400/10 sm:w-72"><Search className="size-4 text-zinc-600" /><span className="sr-only">Buscar fan</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar fan…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-zinc-700" /></label>
          </div>
          {segment !== "ALL" ? <button type="button" onClick={() => setSegment("ALL")} className="mt-3 cursor-pointer text-[11px] font-medium text-violet-300 hover:text-violet-200">Mostrar todos los segmentos</button> : null}
        </div>
        <div className="max-h-[720px] overflow-y-auto">
          {filtered.map((fan) => <FanRow key={fan.id} fan={fan} selected={selected?.id === fan.id} onSelect={() => setSelectedId(fan.id)} />)}
          {!filtered.length ? <div className="p-12 text-center"><UserRoundSearch className="mx-auto size-8 text-zinc-700" /><p className="mt-3 text-sm text-zinc-500">No encontramos fans con estos filtros.</p></div> : null}
        </div>
      </div>
      <aside className="min-w-0">{selected ? <FanCopilot fan={selected} goal={goal} setGoal={setGoal} templates={templates} /> : <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">Selecciona un fan para abrir su copiloto.</div>}</aside>
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

function FanCopilot({ fan, goal, setGoal, templates }: { fan: FanIntelligenceView; goal: "RELATIONSHIP" | "SUBSCRIPTION" | "PPV"; setGoal: (goal: "RELATIONSHIP" | "SUBSCRIPTION" | "PPV") => void; templates: TemplateOption[] }) {
  const draft = buildDraft(fan, goal);
  const recommendedTemplates = templates.filter((template) => goal === "PPV" ? template.type.toLocaleUpperCase() === "PPV" : template.type.toLocaleUpperCase() !== "PPV").slice(0, 3);
  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    enqueueSnackbar("Borrador copiado. Revísalo antes de enviarlo.", { variant: "success" });
  }
  return <div className="sticky top-20 space-y-4">
    <div className="overflow-hidden rounded-3xl border border-violet-400/15 bg-[#15171e] shadow-2xl shadow-violet-950/10">
      <div className="border-b border-white/8 bg-gradient-to-br from-violet-500/12 to-fuchsia-500/[.03] p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-violet-500 text-white"><Bot className="size-5" /></span><div><p className="text-sm font-semibold text-white">Copiloto de relación</p><p className="mt-0.5 text-[10px] text-violet-200/60">Contexto de {fan.displayName}</p></div></div><span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300"><ShieldCheck className="size-3" />Requiere aprobación</span></div></div>
      <div className="space-y-5 p-5">
        <div><div className="flex items-center justify-between"><p className="text-xs font-semibold text-zinc-300">Siguiente mejor acción</p><span className="text-[10px] text-zinc-600">Confianza {Math.max(fan.relationshipScore, fan.valueScore)}%</span></div><p className="mt-2 text-xs leading-5 text-zinc-500">{fan.nextAction}</p></div>
        <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setGoal("RELATIONSHIP")} className={goalButton(goal === "RELATIONSHIP")}><HeartHandshake className="size-3.5" />Conectar</button><button type="button" onClick={() => setGoal("SUBSCRIPTION")} className={goalButton(goal === "SUBSCRIPTION")}><Users className="size-3.5" />Suscripción</button><button type="button" onClick={() => setGoal("PPV")} className={goalButton(goal === "PPV")}><TrendingUp className="size-3.5" />PPV</button></div>
        <div className="rounded-2xl border border-white/8 bg-black/15 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-300"><Sparkles className="size-3.5" />Borrador contextual</div><p className="text-sm leading-6 text-zinc-300">{draft}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => void copyDraft()} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/5"><Copy className="size-3.5" />Copiar</button><Link href={`/messages?fan=${encodeURIComponent(fan.fanvueUserId)}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-400"><MessageCircle className="size-3.5" />Abrir chat</Link></div></div>
        {fan.interests.length ? <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Intereses detectados</p><div className="mt-2 flex flex-wrap gap-2">{fan.interests.map((interest) => <span key={interest} className="rounded-full border border-white/8 bg-white/[.035] px-2.5 py-1 text-[10px] text-zinc-400">{interest}</span>)}</div></div> : null}
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Por qué lo recomendamos</p><ul className="mt-2 space-y-2">{fan.reasons.map((reason) => <li key={reason} className="flex gap-2 text-[11px] leading-5 text-zinc-500"><span className="mt-2 size-1 shrink-0 rounded-full bg-violet-400" />{reason}</li>)}</ul></div>
        {recommendedTemplates.length ? <div><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Plantillas compatibles</p><div className="mt-2 space-y-2">{recommendedTemplates.map((template) => <div key={template.name} className="rounded-xl border border-white/7 bg-white/[.025] px-3 py-2"><p className="truncate text-[11px] text-zinc-300">{template.name}</p><p className="mt-0.5 text-[9px] text-zinc-600">{template.category} · {template.type}</p></div>)}</div></div> : null}
      </div>
    </div>
    <p className="px-2 text-[10px] leading-4 text-zinc-600">La puntuación usa datos observables y no supone emociones. Verifica siempre el contexto antes de vender o enviar contenido de pago.</p>
  </div>;
}

function buildDraft(fan: FanIntelligenceView, goal: "RELATIONSHIP" | "SUBSCRIPTION" | "PPV") {
  const name = fan.displayName.split(/\s+/)[0] || "{{nombre}}";
  const interest = fan.interests[0];
  if (goal === "PPV") return `Hola ${name} 💜 ${interest ? `Me acordé de que te interesa ${interest}. ` : ""}Preparé algo especial que creo que puede gustarte. ¿Quieres que te enseñe una vista previa antes de decidir?`;
  if (goal === "SUBSCRIPTION") return `Hola ${name} ✨ ${interest ? `Como te gusta ${interest}, ` : ""}creo que disfrutarías bastante el contenido para suscriptores. ¿Quieres que te cuente qué incluye para que veas si realmente es para ti?`;
  if (fan.lastInboundText) return `Hola ${name} 😊 Me gustó leerte. ${interest ? `Quiero conocerte mejor: ¿qué es lo que más te gusta de ${interest}?` : "Quiero conocerte mejor, ¿qué tipo de contenido disfrutas más?"}`;
  return `Hola ${name} 😊 Gracias por estar aquí. Quiero conocerte mejor: ¿qué tipo de contenido te gustaría ver de mí?`;
}

function goalButton(active: boolean) {
  return `flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-medium transition ${active ? "border-violet-400/30 bg-violet-500/15 text-violet-200" : "border-white/8 bg-white/[.025] text-zinc-500 hover:text-zinc-300"}`;
}
function MiniScore({ label, value }: { label: string; value: number }) { return <div><div className="h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-violet-400" style={{ width: `${value}%` }} /></div><p className="mt-1 text-[9px] text-zinc-600">{label} {value}</p></div>; }
function readinessLabel(readiness: SaleReadiness) { return readiness === "HOT" ? "Momento activo" : readiness === "WARM" ? "Interés reciente" : "Sin señal reciente"; }
function isNearHighValue(fan: FanIntelligenceView) { return fan.segment === "MID_VALUE" && fan.totalSpentMinor >= 3_000 && fan.totalSpentMinor < 5_000 && Math.max(fan.potentialScore, fan.relationshipScore) >= 70; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "F"; }
