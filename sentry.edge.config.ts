/**
 * Sentry edge runtime config — used by middleware and edge route handlers.
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
