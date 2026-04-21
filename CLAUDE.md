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

- **Google Wallet** : configuré, `GOOGLE_WALLET_ISSUER_ID` / `SERVICE_ACCOUNT_EMAIL` / `PRIVATE_KEY` en env. `lib/google-wallet.ts` respecte `barcode_type` (QR_CODE vs PDF_417). En cours d'approbation par Google.
- **Apple Wallet** : pas encore implémenté (nécessite cert 99 USD/an). Status page a un hint "ajoutez à l'écran d'accueil" pour iOS en attendant.
- **Supabase Storage** : buckets `card-assets` et `business-assets`, path `{businessId}/{folder}/{timestamp}-{random}.{ext}` via service role.

## Gotchas Next.js 16

Voir `AGENTS.md` — cette version a des breaking changes par rapport au training data. Toujours lire `node_modules/next/dist/docs/` avant de supposer le comportement d'une API.
