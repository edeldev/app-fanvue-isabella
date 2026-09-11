"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { closeSnackbar, SnackbarProvider } from "notistack";
import type { ReactNode } from "react";

export function NotificationProvider({ children }: { children: ReactNode }) {
  return <SnackbarProvider
    maxSnack={4}
    autoHideDuration={4500}
    anchorOrigin={{ vertical: "top", horizontal: "right" }}
    preventDuplicate
    iconVariant={{
      success: <CheckCircle2 className="mr-3 size-5 shrink-0 text-emerald-300" />,
      error: <XCircle className="mr-3 size-5 shrink-0 text-red-300" />,
      warning: <TriangleAlert className="mr-3 size-5 shrink-0 text-amber-300" />,
      info: <Info className="mr-3 size-5 shrink-0 text-sky-300" />,
    }}
    action={(snackbarId) => <button type="button" aria-label="Cerrar notificación" onClick={() => closeSnackbar(snackbarId)} className="ml-3 grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"><X className="size-4" /></button>}
    classes={{
      containerRoot: "!z-[300] !top-4 !right-4 !left-4 sm:!left-auto",
      root: "app-snackbar",
    }}
  >{children}</SnackbarProvider>;
}
