@AGENTS.md

# aswallet — contexte projet

> Anciennement FidPass — renommé le 2026-04-21 avec le domaine `aswallet.fr`.

Carte de fidélité digitale (Apple/Google Wallet) pour commerces de proximité.
Stack : Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + Supabase.

## Où chercher quoi

- **Journal de build** : `public/build-log.md` — ce qui a été livré, date par date (plus récent en haut). À **mettre à jour à chaque session** avec une nouvelle entrée datée.
- **Roadmap MVP** : `docs/roadmap.md` — phases 1 à 6.
- **Actions manuelles restantes** : `docs/TODO-manual.md` — Apple Wallet (.pkpass + cert), Google Wallet, Stripe, Resend, Twilio, DNS.
- **Schéma DB** : `docs/database-schema.md` (+ `supabase/migrations/`).
- **Analyse concurrent** : `docs/boomerangme-analysis.md` — le produit s'inspire de Boomerangme.

## Conventions non dérivables du code

- **Commerce halal-friendly** : quand on ajoute des images par défaut (templates, landing, etc.), **aucun visage, aucune femme, aucune awra**. Privilégier les objets / plats / produits. Les URLs Unsplash utilisées dans `lib/card-templates.ts` ont été vérifiées 200 OK et choisies selon cette contrainte.
- **Déploiement** : `git push origin main` déclenche un Vercel deploy auto (GitHub → Vercel). Live sur `https://aswallet.fr` (domaine custom IONOS) + fallback `https://wallet-business-blond.vercel.app`. Pas de vercel CLI nécessaire localement.
- **Port local** : `npm run dev` écoute sur `3000` sauf si occupé (fallback `3001`). Le port 3000 est souvent pris par d'autres projets du user.
- **Toasts** : `useToast()` depuis `@/components/ui/toast`. Remplacer toutes les nouvelles erreurs inline rouge/vert par des toasts.
- **Icônes tampons** : `lib/stamp-icons.tsx` → 14 SVG inline. Chaque template a son `stamp_icon` par défaut (kebab → kebab, café → coffee, etc).
- **Barcode preview** : `card-preview.tsx` rend un vrai QR (client `qrcode`) ou un PDF417 SVG déterministe. Le vrai QR scannable côté client est sur `/c/[token]/status/[instanceToken]`.

## Intégrations externes

- **Google Wallet** : **APPROUVÉ PRODUCTION** (issuer `3388000000023104053`). `GOOGLE_WALLET_ISSUER_ID` / `SERVICE_ACCOUNT_EMAIL` / `PRIVATE_KEY` en env. `lib/google-wallet.ts` :
  - Respecte `barcode_type` (QR_CODE vs PDF_417)
  - **Fallback logo obligatoire** → `https://aswallet.fr/icon.svg` si le commerçant n'a pas uploadé de logo (sinon Google refuse la class avec "LoyaltyClass cannot be created without a program logo").
  - **heroImage dynamique** par loyaltyObject → PNG rendu par `/api/wallet/banner/[instanceToken]/[count]` (Next `ImageResponse`, Satori). Le `count` dans l'URL sert de cache-bust : quand il change, Google refetch. Le renderer reflète le design custom (shape + icon de `lib/stamp-icons.tsx`, + `stamp_active_url` / `stamp_inactive_url` si uploadés).
  - **`syncLoyaltyObject(token, stamps, rewards, appUrl)`** : PATCH le loyaltyObject après chaque scan pour rafraîchir le compte + heroImage. Silencieux sur 404 (pas encore ajouté au Wallet) + timeout 3s. Appelé depuis `api/scan/route.ts`.
  - **Pré-création classes** recommandée via `scripts/sync-wallet-classes.mjs` (plus fiable que le JWT-embedded insert).
- **Apple Wallet** : pas encore implémenté. Nécessite Apple Developer Program (99 USD/an, 24-48h approbation) + Pass Type ID + cert .p12. Génération du cert faisable via openssl sur Windows/Linux (pas besoin de Mac). Status page a un hint "ajoutez à l'écran d'accueil" pour iOS en attendant.
- **Google OAuth** : provider activé côté Supabase (Management API). Bouton `GoogleAuthButton` sur login/register. Callback route `src/app/auth/callback/route.ts` (exchange code + open-redirect guard). Consent screen publié en production, scopes basiques (email/profile/openid → pas de review Google).
- **Supabase Storage** : buckets `card-assets` et `business-assets`, path `{businessId}/{folder}/{timestamp}-{random}.{ext}` via service role.

## Security baseline

- **Headers** dans `next.config.ts` : HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP en **Report-Only** (à flip en enforcing plus tard).
- **Rate limiting** in-memory via `lib/rate-limit.ts` (sliding window per-IP) sur `/api/upload`, `/api/redeem`, `/api/install/[token]`, `/api/invitations/[token]/accept`. Migrable vers Upstash Redis.
- **Env guard** `lib/env.ts` valide les 7 env vars obligatoires au runtime prod (ne casse pas le build CI).
- **Error boundary global** `src/app/error.tsx` (plus de stacktrace affiché en prod).

## RGPD / CNIL

- Tableau finalités/bases légales/durées sur `/privacy`.
- `/mentions-legales` (LCEN), `/terms` (art. 28 sous-traitant + DPA sur demande).
- `/settings/data` : bouton **Exporter mes données** (JSON) et **Supprimer mon compte** (confirmation "SUPPRIMER"). APIs `/api/account/export` + `/api/account` DELETE.
- Consent checkbox obligatoire sur install form `/c/[token]` + vérif server-side.
- **Uniquement cookies techniques** → pas de bannière CNIL lourde, juste un toast info dismissible (`components/public/cookie-notice.tsx`).

## Gotchas Next.js 16

Voir `AGENTS.md` — cette version a des breaking changes par rapport au training data. Toujours lire `node_modules/next/dist/docs/` avant de supposer le comportement d'une API.
