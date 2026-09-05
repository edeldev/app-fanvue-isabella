import { parseServerEnv } from "@/config/env";

export function getFanvueConfig() {
  const env = parseServerEnv();
  return {
    apiBaseUrl: env.FANVUE_API_BASE_URL,
    authBaseUrl: env.FANVUE_AUTH_BASE_URL,
    apiVersion: env.FANVUE_API_VERSION,
    clientId: env.FANVUE_CLIENT_ID,
    clientSecret: env.FANVUE_CLIENT_SECRET,
    redirectUri: env.FANVUE_REDIRECT_URI,
    scopes: ["openid", "offline_access", "offline", ...env.FANVUE_SCOPES.split(/\s+/).filter(Boolean)],
    encryptionKey: env.APP_ENCRYPTION_KEY,
  } as const;
}

