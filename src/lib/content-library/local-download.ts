export function localMediaDownloadAllowed(
  hostname: string,
  environment = process.env.NODE_ENV,
  vercel = process.env.VERCEL,
) {
  return environment === "development"
    && !vercel
    && ["localhost", "127.0.0.1", "::1"].includes(hostname);
}
