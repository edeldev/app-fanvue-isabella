import Link from "next/link";
import { cookies } from "next/headers";
import { BarChart3, CircleDollarSign, Gift, ImageIcon, MessageCircleReply, Repeat2, Send, Target, Users } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

type SearchParams = Promise<{ range?: string | string[]; from?: string | string[]; to?: string | string[] }>;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("es-MX");

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const range = resolveRange(await searchParams);
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const [purchases, enrollments] = creatorId ? await Promise.all([
    prisma.purchase.findMany({
      where: { creatorId, purchasedAt: { gte: range.from, lte: range.to }, amountMinor: { gt: 0 } },
      select: { amountMinor: true, source: true, externalMessageId: true, purchasedAt: true, fanId: true },
      orderBy: { purchasedAt: "asc" },
    }),
    prisma.workflowEnrollment.findMany({
      where: { creatorId, startedAt: { lte: range.to }, OR: [{ logs: { some: { occurredAt: { gte: range.from, lte: range.to } } } }, { completedAt: { gte: range.from } }, { cancelledAt: { gte: range.from } }, { updatedAt: { gte: range.from } }] },
      select: {
        id: true, fanId: true, status: true, startedAt: true,
        workflow: { select: { id: true, name: true, version: true } },
        logs: {
          where: { occurredAt: { gte: range.from, lte: range.to }, eventType: { in: ["WORKFLOW_MESSAGE_SENT", "WORKFLOW_PPV_SENT", "WORKFLOW_FAN_REPLIED", "WORKFLOW_GOAL_COMPLETED"] } },
          select: { eventType: true, occurredAt: true, metadata: true, execution: { select: { step: { select: { id: true, name: true, messageTemplate: { select: { id: true, name: true } } } } } } },
          orderBy: { occurredAt: "asc" },
        },
      },
    }),
  ]) : [[], []];

  const totalRevenueMinor = purchases.reduce((sum, item) => sum + item.amountMinor, 0);
  const revenueBreakdown = purchases.reduce((totals, item) => {
    if (item.source === "tip") totals.tips += item.amountMinor;
    else if (item.source === "subscription" || item.source === "renewal") totals.subscriptions += item.amountMinor;
    else if (item.source === "message" || item.externalMessageId) totals.ppv += item.amountMinor;
    else totals.other += item.amountMinor;
    return totals;
  }, { ppv: 0, tips: 0, subscriptions: 0, other: 0 });
  const payingFans = new Set(purchases.filter((item) => item.amountMinor > 0 && item.fanId).map((item) => item.fanId)).size;
  const allLogs = enrollments.flatMap((enrollment) => enrollment.logs.map((log) => ({ ...log, enrollment })));
  const sends = allLogs.filter((item) => item.eventType === "WORKFLOW_MESSAGE_SENT" || item.eventType === "WORKFLOW_PPV_SENT");
  const repliedFans = new Set(allLogs.filter((item) => item.eventType === "WORKFLOW_FAN_REPLIED").map((item) => item.enrollment.fanId));
  const conversionLogs = allLogs.filter((item) => item.eventType === "WORKFLOW_GOAL_COMPLETED");
  const convertedFans = new Set(conversionLogs.map((item) => item.enrollment.fanId));
  const attributedRevenueMinor = conversionLogs.reduce((sum, item) => sum + metadataNumber(item.metadata, "amountMinor"), 0);
  const contactedFans = new Set(sends.map((item) => item.enrollment.fanId));
  const responseRate = contactedFans.size ? repliedFans.size / contactedFans.size * 100 : 0;
  const conversionRate = contactedFans.size ? convertedFans.size / contactedFans.size * 100 : 0;

  const workflowRows = [...new Map(enrollments.map((item) => [item.workflow.id, item.workflow])).values()].map((workflow) => {
    const records = enrollments.filter((item) => item.workflow.id === workflow.id);
    const logs = allLogs.filter((item) => item.enrollment.workflow.id === workflow.id);
    const workflowSends = logs.filter((item) => item.eventType === "WORKFLOW_MESSAGE_SENT" || item.eventType === "WORKFLOW_PPV_SENT");
    const recipients = new Set(workflowSends.map((item) => item.enrollment.fanId));
    const responders = new Set(logs.filter((item) => item.eventType === "WORKFLOW_FAN_REPLIED").map((item) => item.enrollment.fanId));
    const conversions = logs.filter((item) => item.eventType === "WORKFLOW_GOAL_COMPLETED");
    return { id: workflow.id, name: `${workflow.name} · v${workflow.version}`, enrollments: records.length, sends: workflowSends.length, responders: responders.size, responseRate: recipients.size ? responders.size / recipients.size * 100 : 0, conversions: new Set(conversions.map((item) => item.enrollment.fanId)).size, revenueMinor: conversions.reduce((sum, item) => sum + metadataNumber(item.metadata, "amountMinor"), 0) };
  }).sort((left, right) => right.revenueMinor - left.revenueMinor || right.sends - left.sends);

  const templateMap = new Map<string, { id: string; name: string; sends: number; fans: Set<string>; responders: Set<string>; conversions: Set<string>; revenueMinor: number }>();
  for (const send of sends) {
    const template = send.execution?.step.messageTemplate;
    if (!template) continue;
    const row = templateMap.get(template.id) ?? { id: template.id, name: template.name, sends: 0, fans: new Set(), responders: new Set(), conversions: new Set(), revenueMinor: 0 };
    row.sends += 1; row.fans.add(send.enrollment.fanId); templateMap.set(template.id, row);
  }
  for (const event of allLogs.filter((item) => item.eventType === "WORKFLOW_FAN_REPLIED" || item.eventType === "WORKFLOW_GOAL_COMPLETED")) {
    const previousSend = sends.findLast((candidate) => candidate.enrollment.id === event.enrollment.id && candidate.occurredAt <= event.occurredAt);
    const template = previousSend?.execution?.step.messageTemplate;
    if (!template) continue;
    const row = templateMap.get(template.id);
    if (!row) continue;
    if (event.eventType === "WORKFLOW_FAN_REPLIED") row.responders.add(event.enrollment.fanId);
    else { row.conversions.add(event.enrollment.fanId); row.revenueMinor += metadataNumber(event.metadata, "amountMinor"); }
  }
  const templateRows = [...templateMap.values()].sort((left, right) => right.revenueMinor - left.revenueMinor || right.sends - left.sends);
  const timeline = buildTimeline(range.from, range.to, purchases, allLogs);

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar /><main className="mx-auto max-w-375 px-5 py-8 md:px-8">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-violet-400">Resultados</p><h1 className="text-3xl font-semibold tracking-tight text-white">Analítica real</h1><p className="mt-2 max-w-2xl text-sm text-zinc-500">Ingresos confirmados por Fanvue y resultados atribuibles a tus workflows.</p></div><RangeFilter range={range} /></div>
    {!creatorId ? <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-amber-200">Conecta Fanvue para consultar tus resultados.</div> : <>
      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Ingresos confirmados" value={money.format(totalRevenueMinor / 100)} detail={`${number.format(purchases.length)} pagos`} />
        <Metric icon={Send} label="Mensajes automáticos" value={number.format(sends.length)} detail={`${number.format(contactedFans.size)} fans contactados`} />
        <Metric icon={MessageCircleReply} label="Fans que respondieron" value={number.format(repliedFans.size)} detail={`${responseRate.toFixed(1)}% de respuesta`} />
        <Metric icon={Target} label="Conversiones atribuibles" value={number.format(convertedFans.size)} detail={`${conversionRate.toFixed(1)}% · ${money.format(attributedRevenueMinor / 100)}`} />
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SmallMetric icon={ImageIcon} label="PPV en mensajes" value={money.format(revenueBreakdown.ppv / 100)} detail="Contenido desbloqueado" tone="violet" />
        <SmallMetric icon={Gift} label="Propinas" value={money.format(revenueBreakdown.tips / 100)} detail="Apoyo directo de fans" tone="pink" />
        <SmallMetric icon={Repeat2} label="Suscripciones" value={money.format(revenueBreakdown.subscriptions / 100)} detail="Nuevas y renovaciones" tone="blue" />
        <SmallMetric icon={CircleDollarSign} label="Otros ingresos" value={money.format(revenueBreakdown.other / 100)} detail="Posts, enlaces y otros" tone="amber" />
        <SmallMetric icon={Users} label="Fans que pagaron" value={number.format(payingFans)} detail="Fans únicos del período" tone="emerald" />
      </section>
      <TimelineChart rows={timeline} />
      <section className="mt-8 grid gap-6 2xl:grid-cols-2">
        <ResultsTable title="Rendimiento por workflow" empty="No hubo actividad de workflows en este período." headers={["Workflow", "Envíos", "Respuesta", "Conversiones", "Ingreso atribuido"]} rows={workflowRows.map((row) => [row.name, number.format(row.sends), `${row.responders} (${row.responseRate.toFixed(1)}%)`, number.format(row.conversions), money.format(row.revenueMinor / 100)])} />
        <ResultsTable title="Rendimiento por plantilla" empty="Las plantillas aparecerán después de su primer envío automático." headers={["Plantilla", "Envíos", "Respuesta", "Conversiones", "Ingreso atribuido"]} rows={templateRows.map((row) => [row.name, number.format(row.sends), `${row.responders.size} (${row.fans.size ? (row.responders.size / row.fans.size * 100).toFixed(1) : "0.0"}%)`, number.format(row.conversions.size), money.format(row.revenueMinor / 100)])} />
      </section>
      <div className="mt-6 rounded-xl border border-white/8 bg-white/[.025] p-4 text-xs leading-5 text-zinc-500"><p><strong className="text-zinc-300">Cómo se calcula:</strong> ingresos, PPV y propinas provienen de pagos confirmados sincronizados desde Fanvue. “Otros ingresos” agrupa publicaciones, enlaces multimedia y las demás fuentes distintas de mensajes, propinas y suscripciones. Las cuatro cantidades siempre forman el total.</p><p className="mt-1">Una respuesta o conversión se atribuye al último mensaje automático anterior del mismo workflow. Las conversiones no son iguales a todos los pagos: solo cuentan cuando el workflow tenía un objetivo configurado y Fanvue confirmó que se cumplió.</p></div>
    </>}
  </main></div></div>;
}

function RangeFilter({ range }: { range: ReturnType<typeof resolveRange> }) {
  const presets = [{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }, { value: "90", label: "90 días" }, { value: "all", label: "Todo el tiempo" }];
  return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-2"><div className="flex flex-wrap gap-1">{presets.map((item) => <Link key={item.value} href={`/analytics?range=${item.value}`} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${range.preset === item.value ? "bg-violet-500 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</Link>)}</div><form className="mt-2 flex flex-wrap items-end gap-2 border-t border-white/8 pt-2"><label className="text-[10px] text-zinc-500">Desde<input name="from" type="date" defaultValue={formatDateInput(range.from)} className="mt-1 block rounded-lg border border-white/10 bg-[#181a21] px-2 py-1.5 text-xs text-zinc-300" /></label><label className="text-[10px] text-zinc-500">Hasta<input name="to" type="date" defaultValue={formatDateInput(range.to)} className="mt-1 block rounded-lg border border-white/10 bg-[#181a21] px-2 py-1.5 text-xs text-zinc-300" /></label><button className="rounded-lg bg-white/8 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/12">Aplicar</button></form></div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) { return <article className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><Icon className="size-5 text-violet-400" /><p className="mt-4 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs font-medium text-zinc-300">{label}</p><p className="mt-2 text-[11px] text-zinc-600">{detail}</p></article>; }
const smallMetricTones = {
  violet: "border-violet-400/15 bg-violet-400/[.045] text-violet-300",
  pink: "border-pink-400/15 bg-pink-400/[.045] text-pink-300",
  blue: "border-sky-400/15 bg-sky-400/[.045] text-sky-300",
  amber: "border-amber-400/15 bg-amber-400/[.045] text-amber-300",
  emerald: "border-emerald-400/15 bg-emerald-400/[.045] text-emerald-300",
} as const;

function SmallMetric({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: string; detail: string; tone: keyof typeof smallMetricTones }) {
  return <article className={`group relative overflow-hidden rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 ${smallMetricTones[tone]}`}><div className="flex items-start justify-between gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl border border-current/15 bg-black/15"><Icon className="size-4" /></div><strong className="text-xl font-semibold tracking-tight text-white">{value}</strong></div><p className="mt-4 text-xs font-medium text-zinc-200">{label}</p><p className="mt-1 text-[10px] text-zinc-500">{detail}</p><div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-current/50 to-transparent opacity-60" /></article>;
}

function TimelineChart({ rows }: { rows: Array<{ key: string; label: string; revenueMinor: number; sends: number; conversions: number }> }) {
  const maxRevenue = Math.max(1, ...rows.map((row) => row.revenueMinor));
  const shown = rows.length > 45 ? rows.filter((_, index) => index % Math.ceil(rows.length / 45) === 0 || index === rows.length - 1) : rows;
  return <section className="mt-8 rounded-2xl border border-white/8 bg-white/[.025] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-medium text-white"><BarChart3 className="size-4 text-violet-400" />Ingresos durante el período</h2><p className="mt-1 text-xs text-zinc-500">Cada barra usa pagos confirmados en la fecha indicada.</p></div><p className="text-xs text-zinc-600">{formatShortDate(rows[0]?.key)} — {formatShortDate(rows.at(-1)?.key)}</p></div><div className="mt-6 flex h-52 items-end gap-1 overflow-hidden border-b border-white/10 px-1">{shown.map((row) => <div key={row.key} className="group relative flex h-full min-w-1 flex-1 items-end" title={`${row.label}: ${money.format(row.revenueMinor / 100)} · ${row.sends} envíos · ${row.conversions} conversiones`}><div className="w-full min-w-1 rounded-t-sm bg-gradient-to-t from-violet-700 to-fuchsia-400 transition group-hover:brightness-125" style={{ height: `${Math.max(row.revenueMinor ? 4 : 1, row.revenueMinor / maxRevenue * 100)}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-zinc-700"><span>{rows[0]?.label}</span><span>{rows.at(-1)?.label}</span></div></section>;
}

function ResultsTable({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: string[][] }) { return <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]"><div className="border-b border-white/8 px-5 py-4"><h2 className="font-medium text-white">{title}</h2></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-170 text-left text-xs"><thead className="bg-black/15 text-[10px] uppercase tracking-wide text-zinc-600"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-white/6">{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="text-zinc-400">{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className={`px-4 py-3 ${cellIndex === 0 ? "font-medium text-zinc-200" : cellIndex === row.length - 1 ? "text-emerald-300" : ""}`}>{cell}</td>)}</tr>)}</tbody></table></div> : <p className="p-8 text-center text-xs text-zinc-600">{empty}</p>}</section>; }

function resolveRange(query: Awaited<SearchParams>) {
  const now = new Date(); const end = parseDate(single(query.to), true) ?? now; const customStart = parseDate(single(query.from), false);
  const requestedPreset = single(query.range);
  const preset = customStart ? "custom" : ["7", "30", "90", "all"].includes(requestedPreset ?? "") ? requestedPreset! : "30";
  const start = customStart ?? (preset === "all" ? new Date(2020, 0, 1) : new Date(end.getTime() - (Number(preset) - 1) * 86_400_000)); start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  if (start > end) return { from: new Date(end.getTime() - 29 * 86_400_000), to: end, preset: "30" };
  return { from: start, to: end, preset };
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseDate(value: string | undefined, end: boolean) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`); return Number.isNaN(date.getTime()) ? null : date; }
function formatDateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatShortDate(value?: string) { return value ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)) : "—"; }
function metadataNumber(value: unknown, key: string) { return typeof value === "object" && value && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "number" ? (value as Record<string, number>)[key] : 0; }
function buildTimeline(from: Date, to: Date, purchases: Array<{ amountMinor: number; purchasedAt: Date }>, logs: Array<{ eventType: string; occurredAt: Date }>) {
  const rows = []; const cursor = new Date(from); cursor.setHours(12, 0, 0, 0);
  while (cursor <= to) { const key = formatDateInput(cursor); rows.push({ key, label: new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(cursor), revenueMinor: 0, sends: 0, conversions: 0 }); cursor.setDate(cursor.getDate() + 1); }
  const byDate = new Map(rows.map((row) => [row.key, row]));
  for (const purchase of purchases) { const row = byDate.get(formatDateInput(purchase.purchasedAt)); if (row) row.revenueMinor += purchase.amountMinor; }
  for (const log of logs) { const row = byDate.get(formatDateInput(log.occurredAt)); if (!row) continue; if (log.eventType === "WORKFLOW_MESSAGE_SENT" || log.eventType === "WORKFLOW_PPV_SENT") row.sends += 1; if (log.eventType === "WORKFLOW_GOAL_COMPLETED") row.conversions += 1; }
  return rows;
}
