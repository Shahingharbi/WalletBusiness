/**
 * Sentry server (Node.js) config — used by Next.js route handlers and
 * server components running in the Node runtime.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || "";

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
  });
}
