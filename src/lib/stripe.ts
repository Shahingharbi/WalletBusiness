/**
 * Typed Stripe SDK wrapper.
 *
 * Server-only. Do NOT import from a client component.
 *
 * The env var `STRIPE_SECRET_KEY` is required at runtime. We don't add it to
 * `lib/env.ts` REQUIRED_ENV_VARS list because the rest of the app (cards,
 * scanner, wallet) must continue to work even before Stripe is wired up;
 * billing routes will fail with a clean error instead.
 */

import Stripe from "stripe";

// Cached singleton — Stripe SDK is heavy to instantiate.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "[stripe] STRIPE_SECRET_KEY is not configured. Voir docs/TODO-manual.md section 3."
    );
  }

  _stripe = new Stripe(key, {
    // Pin the API version so behaviour is reproducible. Update deliberately.
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "aswallet",
      url: "https://aswallet.fr",
    },
  });

  return _stripe;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "[stripe] STRIPE_WEBHOOK_SECRET is not configured. Voir docs/TODO-manual.md section 3."
    );
  }
  return secret;
}
