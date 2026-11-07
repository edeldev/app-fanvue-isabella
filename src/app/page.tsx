import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FanvueConnectLanding } from "@/components/fanvue-connect-landing";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";

export const metadata: Metadata = {
  title: "Fanvue CRM | Relaciones, automatización y crecimiento",
  description: "Organiza relaciones, conversaciones, workflows, contenido y resultados de Fanvue desde una experiencia diseñada para creadoras.",
};

export default async function Home() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  return <FanvueConnectLanding connected={Boolean(creatorId)} />;
}
