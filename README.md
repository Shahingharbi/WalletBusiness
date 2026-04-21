# aswallet

Carte de fidelite digitale pour commerces de proximite. Next.js 16 + Supabase.

> Anciennement FidPass — le dossier racine `fidpass/` est volontairement conservé pour ne pas casser les chemins relatifs (docs, scripts, `.vercel`, CLAUDE.md). Seul le nom de l'appli/domaine change.

## Demarrer en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000

## Variables d'env

Copier `.env.example` vers `.env.local` et renseigner :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Deploiement

Projet deploye sur Vercel. `git push origin main` declenche un deploy auto.

## Documentation

- `docs/roadmap.md` — roadmap MVP
- `docs/database-schema.md` — schema Supabase
- `docs/project-structure.md` — arborescence
- `docs/boomerangme-analysis.md` — analyse UX du concurrent
- `docs/TODO-manual.md` — actions manuelles (Apple Wallet, Stripe, etc.)
- `public/build-log.md` — journal de build date par date

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript strict
- Tailwind v4 + fonts Ginto Nord / Maison Neue
- Supabase (auth + DB + storage)
- `html5-qrcode` pour le scanner camera
- `qrcode` pour generer les QR des cartes
