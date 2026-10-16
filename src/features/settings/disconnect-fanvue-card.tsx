"use client";

import { AlertTriangle, ExternalLink, LoaderCircle, Unplug, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { useState } from "react";

export function DisconnectFanvueCard() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/account/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const body = await response.json().catch(() => null) as {
        error?: string;
        fanvueRevocationUrl?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error || "No se pudo eliminar la cuenta local.");
      enqueueSnackbar("Datos locales eliminados. Completa la revocación en Fanvue.", { variant: "success" });
      window.location.assign(body?.fanvueRevocationUrl || "https://www.fanvue.com/settings/account");
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo completar la operación.", { variant: "error" });
      setBusy(false);
    }
  }

  return <>
    <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[.025] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-400/10 text-rose-300"><Unplug className="size-5"/></span><div><h2 className="font-medium text-white">Desconectar Fanvue y eliminar datos</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">Elimina tokens, fans, mensajes sincronizados, workflows, plantillas, contenido, analítica y configuración guardados en esta app. Tu cuenta y contenido original de Fanvue no se eliminan.</p></div></div>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 cursor-pointer rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-400/12">Desconectar y eliminar</button>
      </div>
    </section>
    {open ? <div className="fixed inset-0 z-[300] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="disconnect-title"><div className="w-full max-w-lg rounded-3xl border border-rose-400/20 bg-[#17191f] p-6 shadow-2xl shadow-black/70"><div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-rose-400/10 text-rose-300"><AlertTriangle className="size-6"/></span><button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Cerrar" className="cursor-pointer rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="size-5"/></button></div><h2 id="disconnect-title" className="mt-5 text-xl font-semibold text-white">¿Eliminar esta cuenta de la app?</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Esta acción es irreversible dentro de Fanvue CRM. Detendrá automatizaciones y borrará permanentemente todos los datos locales asociados a tu cuenta.</p><div className="mt-4 rounded-xl border border-violet-400/15 bg-violet-400/[.04] p-3 text-xs leading-5 text-violet-200/70"><p className="font-semibold text-violet-200">Tu cuenta de Fanvue seguirá intacta.</p><p className="mt-1">Después te llevaremos a Fanvue para pulsar <strong>Revoke</strong> en Third Party Apps Consent. Fanvue exige completar ese último paso en su plataforma.</p></div><label className="mt-5 block text-xs text-zinc-500">Escribe <strong className="text-zinc-300">ELIMINAR</strong> para confirmar<input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-rose-400/40"/></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5">Cancelar</button><button type="button" disabled={busy || confirmation !== "ELIMINAR"} onClick={() => void disconnect()} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <LoaderCircle className="size-4 animate-spin"/> : <ExternalLink className="size-4"/>}{busy ? "Eliminando…" : "Eliminar y abrir Fanvue"}</button></div></div></div> : null}
  </>;
}
