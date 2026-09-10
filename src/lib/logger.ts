type LogContext = Readonly<Record<string, unknown>>;

const secretPattern = /authorization|cookie|secret|token|password/i;
const sensitiveValuePattern = /(bearer\s+)[^\s]+|([?&](?:access_token|refresh_token|code|client_secret|password)=)[^&\s]+/gi;

export function sanitizeErrorMessage(message: string): string {
  return message.replace(sensitiveValuePattern, (_match, bearerPrefix: string | undefined, queryPrefix: string | undefined) => `${bearerPrefix ?? queryPrefix ?? ""}[REDACTED]`);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeErrorMessage(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") return sanitizeContext(value as LogContext);
  return value;
}

export function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      secretPattern.test(key) ? "[REDACTED]" : sanitizeValue(value),
    ]),
  );
}

export const logger = {
  info(message: string, context: LogContext = {}): void {
    console.info(JSON.stringify({ level: "info", message, ...sanitizeContext(context) }));
  },
  error(message: string, context: LogContext = {}): void {
    console.error(JSON.stringify({ level: "error", message, ...sanitizeContext(context) }));
  },
};
