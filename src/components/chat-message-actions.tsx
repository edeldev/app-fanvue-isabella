"use client";

import { LoaderCircle, MoreHorizontal, Reply, Trash2, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const CHAT_REPLY_EVENT = "fanvue-crm:reply-message";
export type ChatReplyDetail = { messageUuid: string; sender: string; text: string };

export function ChatMessageActions({ messageUuid, fanUuid, sender, text, canDelete, menuSide }: ChatReplyDetail & { fanUuid: string; canDelete: boolean; menuSide: "left" | "right" }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); setConfirming(false); }
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  function reply() {
    window.dispatchEvent(new CustomEvent<ChatReplyDetail>(CHAT_REPLY_EVENT, { detail: { messageUuid, sender, text } }));
    setOpen(false);
  }

  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(messageUuid)}?fan=${encodeURIComponent(fanUuid)}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "No se pudo eliminar el mensaje.");
      enqueueSnackbar("Mensaje eliminado para todos.", { variant: "success" });
      setOpen(false); setConfirming(false); router.refresh();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo eliminar el mensaje.", { variant: "error" });
    } finally { setDeleting(false); }
  }

  return <div ref={root} className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); setConfirming(false); }} aria-label="Acciones del mensaje" aria-expanded={open} className="grid size-7 cursor-pointer place-items-center rounded-lg text-zinc-600 transition hover:bg-white/8 hover:text-zinc-300"><MoreHorizontal className="size-3.5" /></button>
    {open ? <div className={`absolute bottom-full z-30 mb-1.5 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#20222b] p-1.5 shadow-2xl shadow-black/60 ${menuSide === "left" ? "left-0" : "right-0"}`}>
      {confirming ? <div className="p-2"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-white">¿Eliminar para todos?</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">Desaparecerá también en Fanvue. Esta acción no se puede deshacer.</p></div><button type="button" onClick={() => setConfirming(false)} aria-label="Cancelar eliminación" className="text-zinc-600 hover:text-white"><X className="size-3.5" /></button></div><button type="button" disabled={deleting} onClick={() => void remove()} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-[11px] font-semibold text-white hover:bg-rose-400 disabled:cursor-wait disabled:opacity-50">{deleting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}Eliminar mensaje</button></div> : <><button type="button" onClick={reply} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-violet-500/10 hover:text-violet-200"><Reply className="size-3.5" />Responder a este mensaje</button>{canDelete ? <button type="button" onClick={() => setConfirming(true)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-3.5" />Eliminar para todos</button> : null}</>}
    </div> : null}
  </div>;
}
