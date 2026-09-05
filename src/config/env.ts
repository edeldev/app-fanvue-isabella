import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  APP_ENCRYPTION_KEY: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  FANVUE_API_BASE_URL: z.string().url().default("https://api.fanvue.com"),
  FANVUE_AUTH_BASE_URL: z.string().url().default("https://auth.fanvue.com"),
  FANVUE_API_VERSION: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2025-06-26"),
  FANVUE_CLIENT_ID: z.string().min(1),
  FANVUE_CLIENT_SECRET: z.string().min(1),
  FANVUE_WEBHOOK_SIGNING_SECRET: z.string().min(16),
  FANVUE_REDIRECT_URI: z.string().url(),
  FANVUE_SCOPES: z.string().default(
    "read:self read:creator read:chat write:chat read:fan read:media write:media read:insights",
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(environment: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid server configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
