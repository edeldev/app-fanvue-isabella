import type { FanLifecycleStage } from "@prisma/client";

export const lifecyclePresentation: Record<FanLifecycleStage, { label: string; description: string; tone: string }> = {
  FOLLOWER: { label: "Seguidor", description: "Todavía no avanza a suscripción o compra.", tone: "text-sky-300 bg-sky-400/10 border-sky-400/20" },
  NEW_SUBSCRIBER: { label: "Nuevo suscriptor", description: "Suscripción iniciada durante los últimos 7 días.", tone: "text-violet-300 bg-violet-400/10 border-violet-400/20" },
  ENGAGED: { label: "Interesado", description: "Expresó intención de ver, comprar o desbloquear contenido.", tone: "text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/20" },
  FIRST_BUYER: { label: "Primera compra PPV", description: "Tiene una compra de contenido en mensajes o publicaciones.", tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
  REPEAT_BUYER: { label: "Comprador recurrente PPV", description: "Compró contenido en mensajes o publicaciones al menos dos veces.", tone: "text-emerald-200 bg-emerald-300/10 border-emerald-300/20" },
  HIGH_VALUE: { label: "Alto valor", description: "Superó el umbral de gasto confirmado.", tone: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
  VIP: { label: "VIP", description: "Tiene USD 100 o más de gasto confirmado.", tone: "text-yellow-200 bg-yellow-300/10 border-yellow-300/20" },
  NON_RENEWING: { label: "No renovará", description: "Tiene acceso, pero la renovación está apagada.", tone: "text-orange-300 bg-orange-400/10 border-orange-400/20" },
  EXPIRED: { label: "Vencido", description: "La suscripción terminó.", tone: "text-rose-300 bg-rose-400/10 border-rose-400/20" },
  REACTIVATED: { label: "Reactivado", description: "Volvió después de una suscripción terminada.", tone: "text-teal-300 bg-teal-400/10 border-teal-400/20" },
};

export const lifecycleStages = Object.keys(lifecyclePresentation) as FanLifecycleStage[];
