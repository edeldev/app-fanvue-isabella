import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/fanvue/oauth";
import { FanvueError } from "@/lib/fanvue/errors";
import { logger } from "@/lib/logger";
import { connectFanvueCreator } from "@/services/fanvue/connect-creator";
import { CREATOR_SESSION_COOKIE, createCreatorSession } from "@/lib/session/creator-session";
import { getFanvueConfig } from "@/lib/fanvue/config";

function valuesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function dashboardUrl(_request: NextRequest, status: string): URL {
  const url = new URL("/", getFanvueConfig().redirectUri);
  url.searchParams.set("fanvue", status);
  return url;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const storedState = cookieStore.get("fanvue_oauth_state")?.value;
  const verifier = cookieStore.get("fanvue_pkce_verifier")?.value;
  cookieStore.delete("fanvue_oauth_state");
  cookieStore.delete("fanvue_pkce_verifier");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (request.nextUrl.searchParams.has("error")) {
    return NextResponse.redirect(dashboardUrl(request, "denied"));
  }
  if (!code || !state || !storedState || !verifier || !valuesMatch(state, storedState)) {
    return NextResponse.redirect(dashboardUrl(request, "invalid_state"));
  }
  try {
    const creatorId = await connectFanvueCreator(await exchangeAuthorizationCode(code, verifier));
    cookieStore.set(CREATOR_SESSION_COOKIE, createCreatorSession(creatorId), {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    logger.info("Fanvue creator connected", { creatorId });
    return NextResponse.redirect(dashboardUrl(request, "connected"));
  } catch (caught) {
    logger.error("Fanvue OAuth callback failed", {
      errorName: caught instanceof Error ? caught.name : "UnknownError",
      errorCode: caught instanceof FanvueError ? caught.code : "FANVUE_CONNECTION_ERROR",
      status: caught instanceof FanvueError ? caught.status : 500,
    });
    return NextResponse.redirect(dashboardUrl(request, "connection_failed"));
  }
}
