/**
 * Next.js instrumentation hook — runs once per server process at boot.
 *
 * We use it to load the right Sentry config for each runtime
 * (Node vs Edge). The browser config is loaded automatically by
 * @sentry/nextjs.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Note: `captureRequestError` is the Next.js 15+/16 convention.
// `@sentry/nextjs` re-exports it for App Router error reporting.
import * as Sentry from "@sentry/nextjs";

export const onRequestError = (Sentry as unknown as {
  captureRequestError?: (...args: unknown[]) => unknown;
  onRequestError?: (...args: unknown[]) => unknown;
}).captureRequestError ?? (Sentry as unknown as {
  onRequestError?: (...args: unknown[]) => unknown;
}).onRequestError;
