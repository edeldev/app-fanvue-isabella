import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getFanvueConfig } from "@/lib/fanvue/config";
import { createAuthorizationUrl, createOAuthState, createPkcePair } from "@/lib/fanvue/oauth";

export async function GET() {
  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: new URL(getFanvueConfig().redirectUri).protocol === "https:",
    sameSite: "lax" as const,
    path: "/api/auth/fanvue",
    maxAge: 10 * 60,
  };
  cookieStore.set("fanvue_oauth_state", state, options);
  cookieStore.set("fanvue_pkce_verifier", verifier, options);
  return NextResponse.redirect(createAuthorizationUrl(state, challenge));
}
