import pino from "pino";
import * as Sentry from "@sentry/node";

const isProd = process.env.NODE_ENV === "production";

// ─── Sentry ────────────────────────────────────────────────────────────────────
// Initialize Sentry for automatic error capture + alerting.
// Set SENTRY_DSN in AWS SSM / ECS task definition secrets.
if (isProd && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

// ─── Pino Logger ───────────────────────────────────────────────────────────────
// Production: outputs structured JSON (ECS-compatible, ingested by CloudWatch).
// Development: pretty-prints to stdout.
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
      }),
});

/** Capture an error to Sentry (non-blocking). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (isProd && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) scope.setExtras(context);
      Sentry.captureException(err);
    });
  }
}

/** Wrap an async resolver to log a warning when it exceeds 500ms. */
export function warnSlow<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  return fn().finally(() => {
    const ms = Date.now() - start;
    if (ms > 500) {
      logger.warn({ resolver: name, durationMs: ms }, "Slow resolver detected");
    }
  });
}
