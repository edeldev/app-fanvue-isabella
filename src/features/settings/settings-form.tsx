"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export interface GlobalSettingsView {
  timezone: string;
  sendWindowEnabled: boolean;
  sendingWindowStart: string;
  sendingWindowEnd: string;
  sendingWindowDays: number[];
  sendLimitsEnabled: boolean;
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
  minMinutesBetweenFanMessages: number;
  minimumDelaySeconds: number;
  maximumRetries: number;
  debugMode: boolean;
}

const weekDays = [{ value: 1, label: "L", name: "Lunes" }, { value: 2, label: "M", name: "Martes" }, { value: 3, label: "X", name: "Miércoles" }, { value: 4, label: "J", name: "Jueves" }, { value: 5, label: "V", name: "Viernes" }, { value: 6, label: "S", name: "Sábado" }, { value: 0, label: "D", name: "Domingo" }];
const timeZones = ["America/Monterrey", "America/Mexico_City", "America/Tijuana", "America/Cancun", "America/New_York", "America/Los_Angeles", "UTC"];

export function SettingsForm({ initial }: { initial: GlobalSettingsView }) {
  const router = useRouter();
  const [windowEnabled, setWindowEnabled] = useState(initial.sendWindowEnabled);
  const [limitsEnabled, setLimitsEnabled] = useState(initial.sendLimitsEnabled);
  const [days, setDays] = useState(initial.sendingWindowDays);
  const [debugMode, setDebugMode] = useState(initial.debugMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        timezone: String(data.get("timezone")), sendWindowEnabled: windowEnabled,
        sendingWindowStart: String(data.get("sendingWindowStart")), sendingWindowEnd: String(data.get("sendingWindowEnd")), sendingWindowDays: days,
        sendLimitsEnabled: limitsEnabled, maxMessagesPerHour: Number(data.get("maxMessagesPerHour")), maxMessagesPerDay: Number(data.get("maxMessagesPerDay")), minMinutesBetweenFanMessages: Number(data.get("minMinutesBetweenFanMessages")),
        minimumDelaySeconds: Number(data.get("minimumDelaySeconds")), maximumRetries: Number(data.get("maximumRetries")), debugMode,
      }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setMessage({ text: "Configuración global guardada." }); router.refresh();
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "No se pudo guardar." }); }
    finally { setBusy(false); }
  }

  const input = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-violet-400/50";
  return <form onSubmit={submit} className="space-y-5">
    {message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.error ? "border-red-400/20 bg-red-400/8 text-red-200" : "border-emerald-400/20 bg-emerald-400/8 text-emerald-200"}`}>{message.text}</div> : null}
    <section className="rounded-2xl border border-white/8 bg-white/[.03] p-5"><h2 className="font-medium text-white">Horario global de envío</h2><p className="mt-1 text-xs text-zinc-500">Se usará como valor inicial al crear workflows nuevos. No modifica versiones ya publicadas.</p><label className="mt-5 flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" checked={windowEnabled} onChange={(event) => setWindowEnabled(event.target.checked)} className="size-4 accent-violet-500" />Activar ventana de envío</label><div className={`mt-4 grid gap-4 md:grid-cols-3 ${windowEnabled ? "" : "pointer-events-none opacity-40"}`}><label className="text-xs text-zinc-500">Desde<input name="sendingWindowStart" type="time" required defaultValue={initial.sendingWindowStart} className={input} /></label><label className="text-xs text-zinc-500">Hasta<input name="sendingWindowEnd" type="time" required defaultValue={initial.sendingWindowEnd} className={input} /></label><label className="text-xs text-zinc-500">Zona horaria<select name="timezone" defaultValue={initial.timezone} className={input}>{timeZones.map((zone) => <option key={zone}>{zone}</option>)}</select></label></div><div className={`mt-4 flex flex-wrap gap-2 ${windowEnabled ? "" : "pointer-events-none opacity-40"}`}>{weekDays.map((day) => { const selected = days.includes(day.value); return <button key={day.value} type="button" title={day.name} aria-pressed={selected} onClick={() => setDays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value])} className={`grid size-10 place-items-center rounded-xl border text-xs font-medium ${selected ? "border-violet-400/40 bg-violet-500 text-white" : "border-white/10 text-zinc-500"}`}>{day.label}</button>; })}</div>{windowEnabled && !days.length ? <p className="mt-2 text-xs text-red-300">Selecciona al menos un día.</p> : null}</section>
    <section className="rounded-2xl border border-white/8 bg-white/[.03] p-5"><h2 className="font-medium text-white">Límites de seguridad</h2><p className="mt-1 text-xs text-zinc-500">Defaults para evitar demasiados mensajes y separar contactos al mismo fan.</p><label className="mt-5 flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" checked={limitsEnabled} onChange={(event) => setLimitsEnabled(event.target.checked)} className="size-4 accent-violet-500" />Activar límites en workflows nuevos</label><div className={`mt-4 grid gap-4 md:grid-cols-3 ${limitsEnabled ? "" : "pointer-events-none opacity-40"}`}><label className="text-xs text-zinc-500">Máximo por hora<input name="maxMessagesPerHour" type="number" min={1} max={1000} required defaultValue={initial.maxMessagesPerHour} className={input} /></label><label className="text-xs text-zinc-500">Máximo por 24 horas<input name="maxMessagesPerDay" type="number" min={1} max={10000} required defaultValue={initial.maxMessagesPerDay} className={input} /></label><label className="text-xs text-zinc-500">Minutos entre mensajes al mismo fan<input name="minMinutesBetweenFanMessages" type="number" min={0} max={43200} required defaultValue={initial.minMinutesBetweenFanMessages} className={input} /></label></div></section>
    <section className="rounded-2xl border border-white/8 bg-white/[.03] p-5"><h2 className="font-medium text-white">Fallos y diagnóstico</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs text-zinc-500">Espera inicial de reintento (segundos)<input name="minimumDelaySeconds" type="number" min={1} max={86400} required defaultValue={initial.minimumDelaySeconds} className={input} /></label><label className="text-xs text-zinc-500">Máximo de intentos<input name="maximumRetries" type="number" min={1} max={10} required defaultValue={initial.maximumRetries} className={input} /></label></div><label className="mt-4 flex items-start gap-3"><input type="checkbox" checked={debugMode} onChange={(event) => setDebugMode(event.target.checked)} className="mt-0.5 size-4 accent-violet-500" /><span><span className="block text-sm text-zinc-300">Modo de diagnóstico</span><span className="mt-1 block text-xs text-zinc-600">Registra contexto técnico adicional sin guardar tokens ni secretos.</span></span></label></section>
    <div className="flex justify-end"><button disabled={busy || (windowEnabled && !days.length)} className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"><Save className="size-4" />{busy ? "Guardando…" : "Guardar configuración"}</button></div>
  </form>;
}
