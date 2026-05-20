import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Content-Security-Policy directives.
 *
 * IMPORTANT: This CSP is currently shipped in REPORT-ONLY mode
 * (`Content-Security-Policy-Report-Only`) so it does not break the
 * app while we observe what it would otherwise block.
 *
 * Once you have verified (via browser devtools / any CSP report
 * collector) that NOTHING legitimate is blocked, flip the header
 * key below from `Content-Security-Policy-Report-Only` to
 * `Content-Security-Policy` to enforce it.
 *
 * Notes on `'unsafe-inline' 'unsafe-eval'` in script-src: Next.js
 * currently injects inline hydration scripts; removing these
 * requires adopting the nonce-based CSP flow, which is a separate
 * migration.
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pay.google.com https://apis.google.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://pay.google.com https://accounts.google.com https://walletobjects.googleapis.com wss://*.supabase.co",
  "frame-src https://pay.google.com https://accounts.google.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // camera=(self) enables the QR scanner page; everything else off.
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    // TODO: flip to `Content-Security-Policy` (remove `-Report-Only`)
    // once traffic confirms nothing legitimate is blocked.
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives,
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Image optimization config :
  // - `unoptimized: true` court-circuite le proxy /_next/image de Vercel.
  //   Sur le plan Hobby le quota est 1000 transformations / mois → vite
  //   épuisé sur une landing publique avec quelques mockups. Quand le
  //   quota est plein, Vercel renvoie 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_
  //   REQUIRED → toutes les images affichaient cassé. En désactivant
  //   l'optim, on sert le fichier raw (déjà compressé/sized via sharp
  //   au build), pas de quota consommé.
  // - `remotePatterns` au cas où on repasserait en optim plus tard,
  //   pour les hôtes externes utilisés sur la LP.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "cdn.simpleicons.org" },
    ],
  },
};

// Wrap with Sentry — uploads source maps at build time when SENTRY_AUTH_TOKEN
// is set, otherwise it is a no-op. `silent` keeps build logs clean locally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Hide Sentry's own request from ad blockers via a tunnel route.
  tunnelRoute: "/monitoring",
  // Avoid noisy build output and large bundles for monitoring features
  // we don't currently use.
  disableLogger: true,
  widenClientFileUpload: true,
});
