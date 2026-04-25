/**
 * Sentry client (browser) config.
 *
 * Loaded by @sentry/nextjs at app boot in the browser bundle. Keep this
 * lean: we ship a low sample rate by default and disable PII collection.
 */
import * as Sentry from "@sentry/nextjs";

const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

if (dsn) {
  Sentry.init({
    dsn,
    // Keep traces low on the free tier; bump in dev with NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1
    ),
    // Privacy-friendly defaults — do not pull cookies / IP / headers.
    sendDefaultPii: false,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Don't spam Sentry while developing locally.
    enabled: process.env.NODE_ENV === "production",
  });
}
