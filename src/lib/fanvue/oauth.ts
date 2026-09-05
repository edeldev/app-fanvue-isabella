import { createHash, randomBytes } from "node:crypto";
import { getFanvueConfig } from "./config";
import { FanvueAuthenticationError } from "./errors";
import { fanvueTokenSchema, type FanvueTokenResponse } from "./schemas";
import { z } from "zod";

const oauthErrorSchema = z.object({
  error: z.string().regex(/^[a-z_]+$/).optional(),
}).passthrough();

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function createAuthorizationUrl(state: string, challenge: string): URL {
  const config = getFanvueConfig();
  const url = new URL("/oauth2/auth", config.authBaseUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url;
}

async function requestToken(parameters: URLSearchParams): Promise<FanvueTokenResponse> {
  const config = getFanvueConfig();
  const clientCredentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");
  const response = await fetch(new URL("/oauth2/token", config.authBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${clientCredentials}`,
    },
    body: parameters,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const oauthError = oauthErrorSchema.safeParse(payload);
    const providerCode = oauthError.success ? oauthError.data.error : undefined;
    const code = providerCode
      ? `FANVUE_OAUTH_${providerCode.toUpperCase()}`
      : "FANVUE_OAUTH_TOKEN_REQUEST_FAILED";
    throw new FanvueAuthenticationError(code, response.status);
  }
  const parsed = fanvueTokenSchema.safeParse(payload);
  if (!parsed.success) {
    throw new FanvueAuthenticationError(
      "FANVUE_OAUTH_INVALID_TOKEN_RESPONSE",
      502,
      "Fanvue returned an invalid token response",
    );
  }
  return parsed.data;
}

export function exchangeAuthorizationCode(code: string, verifier: string) {
  const config = getFanvueConfig();
  return requestToken(new URLSearchParams({
    grant_type: "authorization_code", client_id: config.clientId,
    code, redirect_uri: config.redirectUri, code_verifier: verifier,
  }));
}

export function refreshFanvueToken(refreshToken: string) {
  const config = getFanvueConfig();
  return requestToken(new URLSearchParams({
    grant_type: "refresh_token", client_id: config.clientId,
    refresh_token: refreshToken,
  }));
}
