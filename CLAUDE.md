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
- **Apple Wallet** : **LIVE END-TO-END**. Apple Developer Program souscrit (99 USD/an), Pass Type ID `pass.fr.aswallet.loyalty`, Team ID `P46VQPFRPC`. Cert workflow réalisé sur Windows via `openssl` (pas besoin de Mac). 6 env vars Apple sur Vercel (`APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `APPLE_WALLET_WWDR_BASE64`, `APPLE_WALLET_SIGNER_CERT_BASE64`, `APPLE_WALLET_SIGNER_KEY_BASE64`, `APPLE_WALLET_AUTH_SECRET`). `lib/apple-wallet.ts` génère le `.pkpass` (passkit-generator v3.5, type `storeCard`). Strip image dynamique (même endpoint que Google heroImage). Logo merchant fetch + auto-PNG via sharp. Couleurs : `foregroundColor` / `labelColor` auto-contraste selon luminance du fond OU `text_color` explicite du designer.
- **Apple Wallet live updates (APNs phase 2)** : implémenté. Migration `005_apple_pass_devices.sql` (table push tokens). PassKit Web Service complet sous `/api/apple-wallet/v1/*` (register/unregister/list/get-pass/log). `lib/apple-wallet-push.ts` push HTTP/2 raw via `node:http2` en réutilisant le Pass Type cert comme TLS client cert (pas de cert APNs séparé nécessaire). Auto-cleanup stale tokens sur 410. Fire-and-forget après chaque scan (`api/scan/route.ts`).
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

## Pricing & billing

- 4 plans : **Starter 29€**, **Pro 59€** (badge "Le plus choisi"), **Business 129€** (badge "Meilleur rapport qualité-prix"), **Enterprise** sur devis (mailto). Toggle Mensuel / Annuel — annuel = -25% (default). Cf. `lib/billing.ts::PLANS` pour les limites par plan + `lib/billing.ts::STRIPE_PLANS` pour les Stripe.
- **Trial 30 jours sans CB** mais plan obligatoire au signup. `/register?plan=&interval=` lit les query params, redirect `/#pricing` si manquant. Migration 009 (`businesses.intended_plan` + `intended_interval`) appliquée. POST `/api/account/intended-plan` persiste après signup.
- Migration 010 (handle_new_user trial 30j + intended_plan forwarding + bug `gen_random_bytes` re-fix via md5) appliquée.
- Banner trial countdown : soft → warning J+25 (≤5j) → danger J+30+ avec lock dashboard (read-only). Cartes des clients continuent de marcher.
- `STRIPE_PRICE_ID_{STARTER,PRO,BUSINESS}_{MONTHLY,ANNUAL}` env vars (6) à set par le merchant dans Stripe Dashboard.

## Wallet design system

- **Layout simplifié** (mai 2026) : sous le strip, juste 2 fields visibles — `Bonjour {prénom}` (gauche) + `Notre offre` (droite, gros). Plus de "Prochaine récompense" ni "Récompenses dispo" (colonnes vides polluaient).
- **`reward_text` UNIQUE** : la colonne `cards.reward_subtitle` a été DROP (migration 011). Un seul champ "Récompense / Offre" (max 60 chars) dans le designer. Apple adapte la taille du texte selon longueur (≤18 chars → primaryFields gros / 19-32 → secondaryFields moyen / 33+ → auxiliaryFields petit).
- **Couleurs wallet** : Apple respecte `text_color` du designer + auto-contraste fallback. Google n'expose pas de foregroundColor → si `background_color` est trop clair (luminance > 0.6), `lib/wallet-colors.ts::googleEffectiveBgColor()` bascule auto sur `darken(accent, 0.5)` ou `#1a1a1a` pour garantir lisibilité.
- **Card preview en éditeur** : `<CardPreview platform="both">` rend un toggle Apple/Google qui montre UN SEUL mockup à taille pleine (pas 2 demi-mockups tronqués). Switch instantané pour comparer plateformes.
- **Strip image** = grille de tampons SEULE, sans texte ni nom. Endpoint `/api/wallet/banner/[token]/[count]` génère un PNG 1032×336 via Satori (Next ImageResponse). Shape + icon depuis `lib/stamp-render.ts` (path SVG partagé entre preview app et wallet réel pour pixel-parity).
- **Crédit footer** : "Propulsé par aswallet" (sous QR dans la preview, dans `programDetails` Google, dans `barcode.alternateText` Google et Apple).

## Features Boomerangme parity

- **Push campaigns** (Pro+) : `/cards/[id]/campaigns` avec composer + segments (`all`, `inactive_30d`, `has_reward`, `never_redeemed`) + historique. `syncLoyaltyObject` + `messages[]` Google → push silencieux. Apple → APNs phase 2.
- **Geo-Push** : `lib/locations.ts::fetchPassLocations()` + `pass.json.locations[]` Apple + `LoyaltyClass.locations[]` Google. Page `/locations` avec géocodage Nominatim. Gating : Starter 0 / Pro 3 / Business 10. Migration 007 (`locations.relevant_text` + `clients.birthday` + `cards.auto_push_settings` + `auto_push_log`).
- **RFM segmentation** : `lib/rfm.ts` calcule à la volée 5 segments (`champion` / `loyal` / `at_risk` / `lost` / `new`) depuis transactions. Pills + filtres dans `/clients`. API `/api/clients/segments`.
- **Auto-push événementiel** (Pro+) : cron daily 10h via `vercel.json`. 3 triggers idempotents (`inactive_30d`, `near_reward_80`, `birthday`). Settings UI `/cards/[id]/auto-push` avec variables `{name}`, `{reward}`, `{remaining}`.
- **Welcome offer** : `design.welcome_reward` débloque `rewards_available=1` à l'install + push wallet "Bienvenue !".
- **Demo public** : `/demo` (sans auth) — playground avec controls + preview + CTA `/register`.

## Gotchas Next.js 16

Voir `AGENTS.md` — cette version a des breaking changes par rapport au training data. Toujours lire `node_modules/next/dist/docs/` avant de supposer le comportement d'une API.
