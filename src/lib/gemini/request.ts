export async function requestGeminiInteraction({
  apiKey,
  body,
  timeoutMs,
  retryTimeoutMs,
}: {
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  retryTimeoutMs?: number;
}) {
  const timeouts = retryTimeoutMs ? [timeoutMs, retryTimeoutMs] : [timeoutMs];
  let lastError: unknown;
  for (let attempt = 0; attempt < timeouts.length; attempt += 1) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeouts[attempt]),
      });
      if (response.ok || response.status < 500 || attempt === timeouts.length - 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === timeouts.length - 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GEMINI_REQUEST_FAILED");
}
