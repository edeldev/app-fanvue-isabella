type LogContext = Readonly<Record<string, unknown>>;

const secretPattern = /authorization|cookie|secret|token|password/i;

export function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      secretPattern.test(key) ? "[REDACTED]" : value,
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

