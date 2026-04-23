/**
 * Runtime environment-variable validation.
 *
 * Import this ONLY from server-side code (route handlers, server components,
 * server actions). Do NOT import it from a client component — the
 * server-only secrets listed below would be flagged by Next.js.
 *
 * Behavior:
 *  - In **production runtime on Vercel**, missing vars throw a clear error
 *    at import time so the process fails fast and visibly.
 *  - In **build time / CI / preview / local dev**, missing vars only log a
 *    warning. That keeps `npm run build` green on CI where real secrets
 *    may be intentionally absent.
 */

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_PRIVATE_KEY",
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

function collectMissing(): RequiredEnvVar[] {
  return REQUIRED_ENV_VARS.filter((key) => {
    const v = process.env[key];
    return !v || v.trim() === "";
  });
}

// Treat "production on Vercel runtime" as the only environment where we
// fail hard. Build-time on Vercel (`NEXT_PHASE === 'phase-production-build'`)
// still has process.env.VERCEL === '1', but we'd rather not crash the build
// if a var is legitimately only available at runtime — so we additionally
// guard on NEXT_PHASE not being the build phase.
const isVercelProdRuntime =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

const missing = collectMissing();

if (missing.length > 0) {
  const message = `[env] Missing required environment variable(s): ${missing.join(", ")}`;
  if (isVercelProdRuntime) {
    throw new Error(message);
  } else {
    // Non-blocking: warn but let the build / dev server continue.
    // eslint-disable-next-line no-console
    console.warn(`${message} (non-fatal outside of production runtime)`);
  }
}

/**
 * A typed accessor that returns the env var or throws. Prefer this over
 * raw `process.env.X!` in server code so missing values fail with a
 * helpful message instead of `undefined`.
 */
export function requireEnv(name: RequiredEnvVar): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  return v;
}

export const ENV_VARS = REQUIRED_ENV_VARS;
