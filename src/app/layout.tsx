import type { Metadata } from "next";
import "./globals.css";
import { WorkflowAutoRunner } from "@/components/workflow-auto-runner";
import { FanvueReconciler } from "@/components/fanvue-reconciler";

export const metadata: Metadata = {
  title: "Fanvue CRM & Automation",
  description: "Relationship and revenue automation for Fanvue creators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full"><WorkflowAutoRunner /><FanvueReconciler />{children}</body>
    </html>
  );
}
