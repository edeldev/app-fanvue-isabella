"use client";

import { forwardRef } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { closeSnackbar, SnackbarContent, type CustomContentProps } from "notistack";

const presentation = {
  success: { title: "Listo", icon: Check, tone: "text-emerald-300", surface: "bg-emerald-400/10" },
  error: { title: "No se pudo completar", icon: TriangleAlert, tone: "text-rose-300", surface: "bg-rose-400/10" },
  warning: { title: "Atención", icon: TriangleAlert, tone: "text-amber-300", surface: "bg-amber-400/10" },
  info: { title: "Información", icon: Info, tone: "text-sky-300", surface: "bg-sky-400/10" },
  default: { title: "Notificación", icon: Info, tone: "text-violet-300", surface: "bg-violet-400/10" },
} as const;

export const AppToast = forwardRef<HTMLDivElement, CustomContentProps>(function AppToast({ id, message, variant }, ref) {
  const style = presentation[variant] ?? presentation.default;
  const Icon = style.icon;

  return <SnackbarContent ref={ref} role={variant === "error" ? "alert" : "status"} className="!min-w-0 w-[min(430px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1e27]/95 p-0 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,.38)] backdrop-blur-xl">
    <div className="flex w-full items-start gap-3.5 px-4 py-3.5">
      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${style.surface} ${style.tone}`}><Icon className="size-[18px]" strokeWidth={2} /></span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-white">{style.title}</p>
        <div className="mt-0.5 break-words text-[12px] leading-[1.55] text-zinc-400">{message}</div>
      </div>
      <button type="button" aria-label="Cerrar notificación" onClick={() => closeSnackbar(id)} className="ml-auto grid size-8 shrink-0 cursor-pointer place-items-center self-center rounded-lg text-zinc-500 transition hover:bg-white/[.07] hover:text-zinc-200"><X className="size-4" /></button>
    </div>
  </SnackbarContent>;
});
