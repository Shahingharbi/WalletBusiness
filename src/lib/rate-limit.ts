import { NextResponse } from "next/server";

/**
 * Simple in-memory, per-IP sliding-window rate limiter.
 *
 * CAVEAT: The state lives in a module-level `Map`, which means it is scoped
 * to a single Node/serverless instance. On Vercel this is "good enough" for
 * an MVP — hot instances will enforce limits, cold starts reset them, and
 * traffic across different regions/instances is NOT shared. That is
 * acceptable for abuse-mitigation on low-volume endpoints; it is NOT a
 * security guarantee.
 *
 * TODO (post-MVP): migrate to Upstash Redis (`@upstash/ratelimit`) so the
 * counter is shared across every Vercel region/instance.
 */

type Timestamps = number[];

// Module-level store — NOT shared across regions/instances. MVP only.
const store = new Map<string, Timestamps>();

// Housekeeping: prevent the map from growing unbounded on long-lived
// Node processes. Prune stale entries opportunistically.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number, maxWindowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => now - t < maxWindowMs);
    if (fresh.length === 0) {
      store.delete(key);
    } else if (fresh.length !== timestamps.length) {
      store.set(key, fresh);
    }
  }
}

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export interface RateLimitOptions {
  /** Max requests allowed inside the window. */
  limit: number;
  /** Sliding window size in milliseconds. */
  windowMs: number;
  /**
   * Optional key prefix so different routes don't share the same bucket.
   * Defaults to the request URL pathname.
   */
  key?: string;
}

/**
 * Check the rate limit for the given request. Returns a `Response`
 * (HTTP 429) if the limit is exceeded, or `null` when the request
 * may proceed.
 *
 * Usage:
 *   const limited = await rateLimit(request, { limit: 20, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export async function rateLimit(
  req: Request,
  { limit, windowMs, key }: RateLimitOptions,
): Promise<Response | null> {
  const now = Date.now();
  sweep(now, windowMs);

  const routeKey = key ?? new URL(req.url).pathname;
  const ip = getIp(req);
  const bucket = `${routeKey}::${ip}`;

  const existing = store.get(bucket) ?? [];
  const fresh = existing.filter((t) => now - t < windowMs);

  if (fresh.length >= limit) {
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return NextResponse.json(
      { error: "Trop de requetes. Veuillez reessayer plus tard." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((oldest + windowMs) / 1000)),
        },
      },
    );
  }

  fresh.push(now);
  store.set(bucket, fresh);
  return null;
}
