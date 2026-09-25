"use client";

import { useRouter } from "next/navigation";
import { Brain, Check, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";

type Memory = { id: string | null; category: string; value: string; type: "FACT" | "INFERENCE"; confidence: number; evidence: string | null; observedAt: string };

export function FanMemoryCard({ fanId, memories }: { fanId: string; memories: Memory[] }) {
  const router = useRouter();
  const update = async (action: "CONFIRM_MEMORY" | "DISMISS_MEMORY", memoryId: string) => {
    const response = await fetch(`/api/lifecycle/fans/${fanId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, memoryId }) });
    if (!response.ok) return enqueueSnackbar("No se pudo actualizar la memoria", { variant: "error" });
    enqueueSnackbar(action === "CONFIRM_MEMORY" ? "Memoria confirmada" : "Memoria descartada", { variant: "success" });
    router.refresh();
  };
  const refresh = async () => {
    const response = await fetch(`/api/lifecycle/fans/${fanId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "REFRESH_MEMORY" }) });
    if (!response.ok) return enqueueSnackbar("No se pudo guardar la memoria", { variant: "error" });
    enqueueSnackbar("Memoria actualizada con evidencia reciente", { variant: "success" });
    router.refresh();
  };
  return <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><div className="flex items-center gap-2"><Brain className="size-4 text-violet-300"/><h2 className="font-semibold text-white">Memoria del fan</h2></div><p className="mt-1 text-xs leading-5 text-zinc-600">Solo señales con evidencia. Confirma lo correcto y descarta interpretaciones equivocadas.</p>
    {memories.length ? <div className="mt-4 space-y-2">{memories.map((memory) => <article key={memory.id ?? `${memory.category}-${memory.value}`} className="rounded-xl border border-white/7 bg-black/10 p-3"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-zinc-300">{memory.value}</span><span className={`rounded-full px-2 py-0.5 text-[9px] ${memory.type === "FACT" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{memory.type === "FACT" ? "Confirmado" : `${Math.round(memory.confidence * 100)}% inferencia`}</span>{!memory.id ? <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[9px] text-sky-300">Detectado ahora</span> : null}</div><p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-700">{memory.category}</p></div>{memory.id && memory.type === "INFERENCE" ? <div className="flex gap-1"><button onClick={() => update("CONFIRM_MEMORY", memory.id!)} aria-label="Confirmar memoria" className="grid size-7 cursor-pointer place-items-center rounded-lg text-zinc-600 hover:bg-emerald-400/10 hover:text-emerald-300"><Check className="size-3.5"/></button><button onClick={() => update("DISMISS_MEMORY", memory.id!)} aria-label="Descartar memoria" className="grid size-7 cursor-pointer place-items-center rounded-lg text-zinc-600 hover:bg-rose-400/10 hover:text-rose-300"><X className="size-3.5"/></button></div> : null}</div>{memory.evidence ? <p className="mt-2 line-clamp-2 text-[10px] italic leading-4 text-zinc-600">“{memory.evidence}”</p> : null}</article>)}{memories.some((memory) => !memory.id) ? <button type="button" onClick={refresh} className="w-full cursor-pointer rounded-xl border border-violet-400/20 bg-violet-400/[.07] px-3 py-2.5 text-xs font-semibold text-violet-300 hover:bg-violet-400/10">Guardar señales detectadas</button> : null}</div> : <div className="mt-4 rounded-xl border border-dashed border-white/8 p-4 text-center text-xs text-zinc-600">Aún no hay gustos o límites detectados con suficiente evidencia.</div>}
  </section>;
}
