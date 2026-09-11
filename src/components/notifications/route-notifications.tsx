"use client";

import { useEffect, useRef } from "react";
import { enqueueSnackbar, type VariantType } from "notistack";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Notice = { message: string; variant: VariantType };

const fanvueNotices: Record<string, Notice> = {
  connected: {
    message:
      "Fanvue se conectó correctamente. Tus credenciales están cifradas.",
    variant: "success",
  },
  denied: {
    message: "La autorización de Fanvue fue cancelada.",
    variant: "warning",
  },
  invalid_state: {
    message:
      "La sesión de conexión expiró. Intenta conectar Fanvue nuevamente.",
    variant: "error",
  },
  connection_failed: {
    message: "No se pudo conectar con Fanvue de forma segura.",
    variant: "error",
  },
  signed_out: { message: "Sesión cerrada correctamente.", variant: "info" },
  connection_required: {
    message: "Conecta Fanvue antes de continuar.",
    variant: "warning",
  },
};
const syncNotices: Record<string, Notice> = {
  completed: {
    message: "Sincronización de Fanvue completada.",
    variant: "success",
  },
  failed: {
    message: "La sincronización falló. Revisa el registro del servidor.",
    variant: "error",
  },
  unauthorized: {
    message: "Vuelve a conectar Fanvue antes de sincronizar.",
    variant: "warning",
  },
};
const messageErrors: Record<string, string> = {
  rate_limited:
    "Has realizado demasiados envíos. Espera un momento e inténtalo nuevamente.",
  invalid_message: "El mensaje está vacío o contiene datos inválidos.",
  invalid_price: "El PPV necesita archivos y un precio mínimo de $3.00.",
  invalid_ppv_preview:
    "Selecciona una vista gratuita y al menos un archivo bloqueado.",
  invalid_recipient: "Este contacto no puede recibir mensajes actualmente.",
  invalid_template: "La plantilla seleccionada ya no está disponible.",
  send_failed: "Fanvue no pudo enviar el mensaje. Inténtalo nuevamente.",
};
const templateErrors: Record<string, string> = {
  duplicate: "Ya existe una plantilla con ese nombre.",
  in_use: "No puedes eliminarla porque un workflow está usando esta plantilla.",
  not_found: "La plantilla ya no existe.",
  invalid: "Revisa los datos de la plantilla.",
  unknown: "No se pudo completar la operación con la plantilla.",
};

export function RouteNotifications() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef("");

  useEffect(() => {
    const serialized = searchParams.toString();
    const key = `${pathname}?${serialized}`;
    if (!serialized || handled.current === key) return;
    const notices: Notice[] = [];
    const fanvue = searchParams.get("fanvue");
    const sync = searchParams.get("sync");
    if (fanvue && fanvueNotices[fanvue]) notices.push(fanvueNotices[fanvue]);
    if (sync && syncNotices[sync]) notices.push(syncNotices[sync]);
    if (pathname === "/messages" && searchParams.has("sent"))
      notices.push({
        message: "Mensaje enviado correctamente.",
        variant: "success",
      });
    const error = searchParams.get("error");
    if (pathname === "/messages" && error)
      notices.push({
        message: messageErrors[error] ?? "No se pudo enviar el mensaje.",
        variant: "error",
      });
    if (pathname === "/templates" && searchParams.has("saved"))
      notices.push({
        message: "Plantilla guardada correctamente.",
        variant: "success",
      });
    if (pathname === "/templates" && searchParams.has("deleted"))
      notices.push({
        message: "Plantilla eliminada correctamente.",
        variant: "success",
      });
    if (pathname === "/templates" && error)
      notices.push({
        message: templateErrors[error] ?? templateErrors.unknown,
        variant: "error",
      });
    if (!notices.length) return;
    handled.current = key;
    notices.forEach((notice) =>
      enqueueSnackbar(notice.message, { variant: notice.variant }),
    );
    const clean = new URLSearchParams(searchParams);
    [
      "fanvue",
      "sync",
      "sent",
      "saved",
      "deleted",
      "error",
      "retryAfter",
    ].forEach((name) => clean.delete(name));
    router.replace(clean.size ? `${pathname}?${clean}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  return null;
}
