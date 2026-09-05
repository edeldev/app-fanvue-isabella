import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { CREATOR_SESSION_COOKIE } from "@/lib/session/creator-session";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(CREATOR_SESSION_COOKIE);
  cookieStore.delete("fanvue_oauth_state");
  cookieStore.delete("fanvue_pkce_verifier");

  const destination = new URL("/", request.url);
  destination.searchParams.set("fanvue", "signed_out");
  return NextResponse.redirect(destination, 303);
}
