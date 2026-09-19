"use client";

import { Bell, BellRing, Heart, LoaderCircle, MessageCircle, Trash2, UserPlus, Volume2, VolumeX } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EngagementNotificationView } from "@/domain/notifications/engagement";

const POLL_INTERVAL_MS = 5_000;
const READ_KEY = "fanvue-engagement-notifications-read-at";
const SOUND_KEY = "fanvue-engagement-notifications-sound";

export function EngagementNotificationsMenu() {
  const [notifications, setNotifications] = useState<EngagementNotificationView[]>([]);
  const [readAt, setReadAt] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const cursor = useRef("");
  const menu = useRef<HTMLDetailsElement>(null);
  const initialized = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const preferenceFrame = window.requestAnimationFrame(() => {
      setReadAt(window.localStorage.getItem(READ_KEY) ?? "");
      setSoundEnabled(window.localStorage.getItem(SOUND_KEY) !== "off");
    });

    const unlockAudio = () => {
      if (!audioContext.current) audioContext.current = new AudioContext();
      if (audioContext.current.state === "suspended") void audioContext.current.resume();
    };
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.cancelAnimationFrame(preferenceFrame);
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      if (audioContext.current) void audioContext.current.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const query = new URLSearchParams({ limit: "25" });
        if (cursor.current) query.set("after", cursor.current);
        const response = await fetch(`/api/notifications?${query}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const body = await response.json() as { cursor: string; notifications: EngagementNotificationView[] };
        cursor.current = body.cursor;
        if (!initialized.current) {
          initialized.current = true;
          setNotifications(body.notifications.slice(-25).reverse());
          return;
        }
        if (!body.notifications.length) return;
        setNotifications((current) => {
          const known = new Set(current.map((item) => item.id));
          const incoming = body.notifications.filter((item) => !known.has(item.id));
          return [...incoming.reverse(), ...current].slice(0, 25);
        });
        body.notifications.forEach((notification) => enqueueSnackbar(notification.message, { variant: "info", key: notification.id }));
        if (soundEnabled) playSound(audioContext.current);
      } catch {
        // El siguiente ciclo vuelve a intentar sin interrumpir la navegación.
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [soundEnabled]);

  const unreadCount = useMemo(() => notifications.filter((item) => !readAt || item.createdAt > readAt).length, [notifications, readAt]);

  function markRead() {
    const newest = notifications[0]?.createdAt ?? new Date().toISOString();
    setReadAt(newest);
    window.localStorage.setItem(READ_KEY, newest);
  }

  function toggleSound() {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    if (enabled) {
      if (!audioContext.current) audioContext.current = new AudioContext();
      void audioContext.current.resume().then(() => playSound(audioContext.current));
    }
  }

  async function clearNotifications() {
    setClearing(true);
    try {
      const response = await fetch("/api/notifications", { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar el historial.");
      const body = await response.json() as { deleted: number };
      setNotifications([]);
      setConfirmingClear(false);
      cursor.current = new Date().toISOString();
      const clearedAt = cursor.current;
      setReadAt(clearedAt);
      window.localStorage.setItem(READ_KEY, clearedAt);
      if (menu.current) menu.current.open = false;
      enqueueSnackbar(body.deleted === 1 ? "Se eliminó 1 notificación." : `Se eliminaron ${body.deleted} notificaciones.`, { variant: "success" });
    } catch {
      enqueueSnackbar("No se pudo eliminar el historial de notificaciones.", { variant: "error" });
    } finally {
      setClearing(false);
    }
  }

  return <details ref={menu} className="group relative" onToggle={(event) => { if (event.currentTarget.open) markRead(); else setConfirmingClear(false); }}>
    <summary aria-label={`${unreadCount} notificaciones nuevas`} className="relative grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-white/8 text-zinc-400 transition hover:border-white/15 hover:text-white [&::-webkit-details-marker]:hidden">
      {unreadCount ? <BellRing className="size-4 text-violet-300" /> : <Bell className="size-4" />}
      {unreadCount ? <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[9px] font-bold leading-5 text-white ring-2 ring-[#101218]">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
    </summary>
    <div onClick={(event) => event.stopPropagation()} className="absolute right-0 mt-3 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#181a21] shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 p-4">
        <div><p className="text-sm font-semibold text-white">Actividad en tiempo real</p><p className="mt-0.5 text-[10px] text-zinc-600">Seguidores, likes y comentarios</p></div>
        <button type="button" onClick={toggleSound} aria-label={soundEnabled ? "Silenciar notificaciones" : "Activar sonido"} title={soundEnabled ? "Sonido activado" : "Sonido desactivado"} className="grid size-9 place-items-center rounded-lg border border-white/8 text-zinc-400 hover:bg-white/5 hover:text-white">{soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</button>
      </div>
      <div className="max-h-96 overflow-y-auto">{notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}{!notifications.length ? <div className="p-8 text-center"><Bell className="mx-auto size-6 text-zinc-700" /><p className="mt-2 text-xs text-zinc-500">La nueva actividad aparecerá aquí.</p></div> : null}</div>
      {confirmingClear ? <div className="border-t border-white/8 bg-red-500/5 p-3"><p className="text-xs font-medium text-zinc-200">¿Eliminar todo el historial de actividad?</p><p className="mt-1 text-[10px] text-zinc-500">Esta acción limpia estos registros de la base de datos y no se puede deshacer.</p><div className="mt-3 flex justify-end gap-2"><button type="button" disabled={clearing} onClick={() => setConfirmingClear(false)} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Conservar</button><button type="button" disabled={clearing} onClick={() => void clearNotifications()} className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50">{clearing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}Eliminar</button></div></div> : <div className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3"><p className="text-[10px] text-zinc-600">Se actualiza cada 5 s · retención 90 días</p>{notifications.length ? <button type="button" onClick={() => setConfirmingClear(true)} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"><Trash2 className="size-3" />Eliminar historial</button> : null}</div>}
    </div>
  </details>;
}

function NotificationRow({ notification }: { notification: EngagementNotificationView }) {
  const Icon = notification.type === "FOLLOW_CREATED" ? UserPlus : notification.type === "POST_LIKED" ? Heart : MessageCircle;
  const tone = notification.type === "FOLLOW_CREATED" ? "bg-violet-400/10 text-violet-300" : notification.type === "POST_LIKED" ? "bg-pink-400/10 text-pink-300" : "bg-sky-400/10 text-sky-300";
  return <div className="border-b border-white/6 p-4 last:border-0"><div className="flex items-start gap-3"><span className={`grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl ${tone}`}>{notification.avatarUrl ? <span className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(notification.avatarUrl).slice(1, -1)})` }} /> : <Icon className="size-4" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-zinc-200">{notification.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{notification.message}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-zinc-600">{notification.actorUsername ? `@${notification.actorUsername}` : notification.actorName}</span><time dateTime={notification.occurredAt} className="shrink-0 text-[10px] text-zinc-700">{new Date(notification.occurredAt).toLocaleString("es-MX")}</time></div></div></div></div>;
}

function playSound(context: AudioContext | null) {
  if (!context || context.state !== "running") return;
  const now = context.currentTime;
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.exponentialRampToValueAtTime(1_040, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.25);
}
