import { cookies } from "next/headers";
import { CREATOR_SESSION_COOKIE, readCreatorSession } from "@/lib/session/creator-session";
import { runDueWorkflows } from "@/services/automation/workflow-runner";

export async function POST() {
  const creatorId = readCreatorSession((await cookies()).get(CREATOR_SESSION_COOKIE)?.value);
  if (!creatorId) return Response.json({ error: "Sesión no autorizada." }, { status: 401 });
  return Response.json(await runDueWorkflows(creatorId));
}
