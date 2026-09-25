import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ContactRound, Search } from "lucide-react";
import type { FanLifecycleStage } from "@prisma/client";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { lifecyclePresentation, lifecycleStages } from "@/domain/lifecycle/presentation";
import { prisma } from "@/lib/prisma";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
type SearchParams = Promise<{ stage?: string | string[]; q?: string | string[] }>;

export default async function LifecyclePage({ searchParams }: { searchParams: SearchParams }) {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  const params = await searchParams;
  const rawStage = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const stage = lifecycleStages.includes(rawStage as FanLifecycleStage) ? rawStage as FanLifecycleStage : null;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 80) ?? "";
  const [counts, fans] = creatorId ? await Promise.all([
    prisma.fan.groupBy({ by: ["lifecycleStage"], where: { creatorId, isCreatorAccount: false }, _count: { _all: true } }),
    prisma.fan.findMany({
      where: {
        creatorId,
        isCreatorAccount: false,
        ...(stage ? { lifecycleStage: stage } : {}),
        ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ lifecycleChangedAt: "desc" }, { lastActivityAt: "desc" }],
      take: 100,
      include: { tags: { include: { tag: true } } },
    }),
  ]) : [[], []];
  const countMap = new Map(counts.map((item) => [item.lifecycleStage, item._count._all]));

  return <div className="flex min-h-screen bg-[#101218] text-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Topbar />
    <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-400">Relación completa</p><h1 className="text-3xl font-semibold text-white">Fan Lifecycle</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">Una vista operativa desde el primer follow hasta retención y reactivación. Cada cambio queda explicado en el historial del fan.</p></div>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{lifecycleStages.map((item) => { const meta = lifecyclePresentation[item]; const active = stage === item; return <Link key={item} href={active ? "/lifecycle" : `/lifecycle?stage=${item}`} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${active ? meta.tone : "border-white/8 bg-white/[.025] hover:border-white/15"}`}><p className="text-2xl font-semibold text-white">{countMap.get(item) ?? 0}</p><p className="mt-1 text-sm font-medium">{meta.label}</p><p className="mt-2 text-xs leading-5 text-zinc-600">{meta.description}</p></Link>; })}</div>
      <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]">
        <div className="flex flex-col gap-4 border-b border-white/8 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-white">Fans en seguimiento</h2><p className="mt-1 text-xs text-zinc-500">{fans.length} resultados visibles</p></div><form className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111319] px-4 focus-within:border-violet-400/40"><Search className="size-4 text-zinc-600"/><input name="q" defaultValue={q} placeholder="Buscar fan…" className="h-11 bg-transparent text-sm outline-none placeholder:text-zinc-700"/>{stage ? <input type="hidden" name="stage" value={stage}/> : null}</form></div>
        {fans.length ? <div className="divide-y divide-white/6">{fans.map((fan) => { const meta = lifecyclePresentation[fan.lifecycleStage]; return <Link key={fan.id} href={`/lifecycle/fans/${fan.id}`} className="grid gap-4 p-5 transition hover:bg-white/[.025] md:grid-cols-[minmax(220px,1fr)_minmax(170px,.7fr)_minmax(220px,1fr)_auto] md:items-center"><div><p className="font-medium text-zinc-100">{fan.displayName || fan.username || "Fan sin nombre"}</p><p className="mt-1 text-xs text-zinc-600">@{fan.username || "sin-usuario"}</p></div><span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${meta.tone}`}>{meta.label}</span><div><p className="line-clamp-2 text-xs leading-5 text-zinc-500">{fan.lifecycleReason || meta.description}</p><div className="mt-2 flex flex-wrap gap-1">{fan.tags.map(({ tag }) => <span key={tag.id} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{tag.name}</span>)}</div></div><div className="flex items-center gap-4"><span className="text-sm font-semibold text-white">{money.format(fan.totalSpentMinor / 100)}</span><ArrowRight className="size-4 text-zinc-600"/></div></Link>; })}</div> : <div className="grid min-h-60 place-items-center text-center"><div><ContactRound className="mx-auto mb-3 size-7 text-zinc-700"/><p className="text-sm text-zinc-400">No hay fans con estos filtros.</p></div></div>}
      </section>
    </main>
  </div></div>;
}

