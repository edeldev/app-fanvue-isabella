import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { WorkflowAutoRunner } from "@/components/workflow-auto-runner";
import { FanvueReconciler } from "@/components/fanvue-reconciler";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";

export const metadata: Metadata = {
  title: "Fanvue CRM & Automation",
  description: "Relationship and revenue automation for Fanvue creators.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const creatorId = readCreatorSession(
    cookieStore.get(CREATOR_SESSION_COOKIE)?.value,
  );

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <a href="#main-content" className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-xl transition focus:translate-y-0">Saltar al contenido principal</a>
        {creatorId ? (
          <>
            <WorkflowAutoRunner />
            <FanvueReconciler />
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}
