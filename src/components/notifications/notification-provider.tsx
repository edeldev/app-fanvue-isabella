"use client";

import { SnackbarProvider } from "notistack";
import type { ReactNode } from "react";
import { AppToast } from "./app-toast";

export function NotificationProvider({ children }: { children: ReactNode }) {
  return <SnackbarProvider
    maxSnack={3}
    autoHideDuration={5200}
    anchorOrigin={{ vertical: "top", horizontal: "right" }}
    Components={{ success: AppToast, error: AppToast, warning: AppToast, info: AppToast, default: AppToast }}
    classes={{
      containerRoot: "!z-[300] !top-4 !right-4 !left-4 sm:!left-auto",
    }}
  >{children}</SnackbarProvider>;
}
