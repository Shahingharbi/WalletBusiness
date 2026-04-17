# Journal de build FidPass

> Trace de ce qui est livré chaque jour. Pour ta mémoire et la mienne.
> Le plus récent en premier.

---

## 2026-04-17 — Landing + 3 nouveaux types + dashboard complet + segments

### Landing page (`/`)
- Portée depuis `ai-website-cloner-template/` dans `src/components/landing/`
- 9 sections : `TopBanner`, `Navbar`, `HeroSection`, `SocialProofSection`, `WhyWalletSection`, `HowItWorksSection`, `FeaturesSection`, `WalletStatsSection`, `PricingSection`, `CTASection`, `Footer`
- Fonts locales chargées dans `layout.tsx` : Ginto Nord (titres), Maison Neue (corps), Maison Neue Extended (boutons/labels). Fichiers copiés dans `public/fonts/`
- `globals.css` étendu : palette beige (#f9f7f0), jaune (#fff382, #ffe94d), dark (#1a1e22), variables CSS exposées dans `@theme inline`
- Tous les CTAs pointent vers `/login` ou `/register` (Link Next, pas anchors)
- `CTASection` : formulaire email + nom commerce qui pré-remplit `/register?email=…&business=…`
- `RegisterPage` : `useSearchParams` pour récupérer ces query params (wrappé dans `<Suspense>` pour le build)
- `app/page.tsx` : redirect `/dashboard` si user loggé, sinon `<LandingShell />`
- Middleware : suppression du redirect `/` → `/login` qui empêchait la landing de s'afficher

### Dashboard refait (Phase 5 à 100%)
- `app/(dashboard)/dashboard/page.tsx` accepte `searchParams.range`
- Filtres temporels pill : Aujourd'hui / 7 j / 30 j / 12 mois
- 4 KPIs avec **comparaison vs période précédente** (% delta + tendance) : Clients, Cartes actives, Scans, Récompenses
- `ScansChart` retravaillé : barres journalières, tooltip au hover, échelle adaptive
- Bloc "Top cartes" (5 plus scannées sur la période)
- Activité récente (8 dernières transactions avec nom client + carte)
- `lib/range.ts` : utilitaire serveur `rangeToDates(range)` (extrait du composant client pour éviter l'erreur server/client)
- `RangeFilter` : composant client séparé qui push les query params

### Phase 6 — Polish à 100%
- `components/ui/skeleton.tsx` + 3 fichiers `loading.tsx` (dashboard, cards, clients)
- Animations CSS dans `globals.css` : `stamp-pop`, `celebrate`, `confetti-fall`, `fade-in-up`
- `components/scanner/confetti.tsx` : 40 particules qui tombent quand récompense gagnée
- Scanner page : `<div className="animate-celebrate">` sur le bloc "Récompense gagnée", `<div className="animate-stamp-pop">` sur "Tampon ajouté"
- Page `not-found.tsx` (déjà faite hier)
- OG meta sur `/c/[token]` (déjà fait hier)

### 3 nouveaux types de cartes (Cashback, Remise, Adhésion)
- `lib/constants.ts` : `CARD_TYPES.cashback/discount/membership` passés à `available: true`
- `step-settings.tsx` accepte un prop `cardType` et adapte labels/placeholders :
  - **Stamp** : nb tampons + récompense
  - **Cashback** : nb visites avant cashback + description ("5% cashback sur chaque achat")
  - **Discount** : pas de compteur, juste l'avantage permanent ("-10% sur tous vos achats")
  - **Membership** : pas de compteur, niveau d'adhésion ("Acces illimité + reductions partenaires")
- `card-preview.tsx` accepte `cardType` et change le rendu central :
  - Stamp/Cashback → grille de tampons
  - Discount → icône Percent géante
  - Membership → icône Crown géante
- `cards/new/page.tsx` et `cards/[id]/edit/edit-form.tsx` passent `cardType` aux 2 composants
- `card-preview-server.tsx` accepte aussi `card_type`

### Templates de cartes (14 presets)
- `lib/card-templates.ts` : Kebab, Boulangerie, Pizzeria, Café, Restaurant, Coiffeur, Institut beauté, Pressing, Fleuriste, Barbier, Épicerie (cashback), VIP Premium (membership), Remise (discount), "Repartir de zéro"
- Chaque template : type + nom + récompense + nb tampons + design (3 couleurs)
- `step-template.tsx` : grille 4 colonnes avec emoji + label + type
- Wizard `cards/new/page.tsx` étendu à **4 étapes** : Modèle → Type → Paramètres → Design
- Sélection d'un template pré-remplit tous les champs (l'utilisateur peut ensuite tout personnaliser)

### Page détail client + segments
- `clients/[id]/page.tsx` : avatar initial, infos contact (téléphone clickable, email mailto), KPIs (tampons total, récompenses utilisées, nb cartes), liste des cartes installées, historique 50 transactions avec icônes/couleurs par type
- `clients/page.tsx` refait avec :
  - 4 filtres pill : Tous / Actifs (scan ≤ 30 j) / Inactifs (>30 j) / Récompense dispo
  - Compteurs sur chaque pill
  - Recherche par nom/téléphone (`q=` query param)
  - Colonnes : Client (clickable vers détail), Téléphone, Cartes, Tampons, Récompenses, Dernier scan, Statut (Actif/Inactif badge)
- `clients-filter.tsx` : composant client avec `useTransition` pour les transitions douces

### PWA pour la page client
- `app/manifest.ts` : standalone, theme color #10b981
- `public/icon.svg` : logo gradient vert→jaune avec 6 cercles (tampons)
- `(public)/layout.tsx` : meta `appleWebApp` + viewport non zoomable

### Doc
- `docs/TODO-manual.md` créé : Apple Wallet (.pkpass + cert 99 USD/an), Google Wallet, Stripe billing, Resend, Twilio, déploiement Vercel + DNS

### Validation
- `npx tsc --noEmit` ✅
- `npm run build` ✅ — 24 routes générées + manifest

### Bugs corrigés
- `rangeToDates` était dans un fichier `"use client"`, importé par un server component → erreur runtime. Extrait dans `lib/range.ts`
- Middleware redirigeait `/` vers `/login` (empêchait la landing de s'afficher) → conditionné à `user` connecté

---

## 2026-04-16 — Combler les trous du roadmap MVP

### Audit
- État réel du repo : 75 % de la roadmap original déjà fait (auth, layout, wizard 3 étapes, install client, scan/redeem API, dashboard KPIs basiques)
- Trous bloquants identifiés : upload images, caméra, settings éditable, edit carte, invitations employés, stats/clients par carte

### Bugs schéma critiques corrigés
- Le code utilisait `cards.max_stamps` partout, mais la colonne réelle est `cards.stamp_count`. Cassait le scan en prod (PostgREST renvoyait erreur "column does not exist")
- Fix : tous les `SELECT` aliasés en `max_stamps:stamp_count` ou champs renommés en `stamp_count`
- Page settings lisait `email` et `website` qui n'existent pas dans la table `businesses` → champs supprimés

### Upload d'images Supabase Storage
- `api/upload/route.ts` : accepte PNG/JPG/WEBP/SVG, max 3 Mo, upload dans buckets `card-assets` ou `business-assets` avec path `{businessId}/{folder}/{timestamp}-{random}.{ext}` via service role
- `components/ui/image-upload.tsx` : composant drag & drop avec preview, bouton supprimer, état uploading
- Intégré dans `step-design.tsx` (logo + bannière de carte) et `settings-forms.tsx` (logo du commerce)

### Caméra QR scanner réelle
- `npm i html5-qrcode`
- `components/scanner/camera-scanner.tsx` : import dynamique de `html5-qrcode`, demande accès caméra `environment` (arrière), debounce 2 s pour éviter les doubles lectures, parser intelligent qui gère les QR contenant une URL ou juste le token
- Page `/scanner` : toggle Caméra ↔ Manuel, auto-validation au scan détecté

### Settings éditable
- `api/profile/route.ts` PATCH : prénom, nom, téléphone, avatar
- `api/business/route.ts` PATCH : nom, adresse, ville, code postal, téléphone, catégorie, logo
- `settings-forms.tsx` : 2 formulaires séparés (Profil + Commerce) avec messages success/error
- Page settings refaite : utilise les nouveaux composants + `InvitationsManager`

### Édition de carte
- `api/cards/[id]/route.ts` PATCH (modifs) + DELETE (archive, pas hard delete)
- `cards/[id]/edit/page.tsx` + `edit-form.tsx` : réutilise `StepSettings` + `StepDesign`, warning si carte active, bouton archiver

### Invitations employés
- `api/invitations/route.ts` : POST (créer invite avec token, expire 7 j) + DELETE (revoke)
- `api/invitations/[token]/accept/route.ts` : crée le compte via `auth.admin.createUser` avec role `employee`, met à jour le profil pour pointer vers le business de l'inviteur, supprime le business auto-créé
- `(dashboard)/settings/invitations-manager.tsx` : formulaire d'invitation + liste des invitations en attente avec bouton "Copier le lien" + liste des employés actifs
- `(auth)/invitation/[token]/page.tsx` + `accept-form.tsx` : page publique d'acceptation, crée le compte puis sign-in auto puis redirect `/scanner`

### Stats par carte + clients par carte
- `cards/[id]/stats/page.tsx` : 3 KPIs (installations, tampons distribués, récompenses utilisées) + chart 30 derniers jours via `ScansChart`
- `cards/[id]/clients/page.tsx` : tableau des instances de cette carte avec client, tampons, récompenses, dernier scan, statut
- Liens depuis `cards/[id]/page.tsx` (tabs)

### Polish + edge cases
- Protection double-scan dans `api/scan` : refuse si un `stamp_add` < 60 s sur la même `card_instance`
- OG meta tags sur `/c/[token]` via `generateMetadata` (image bannière + titre = nom carte)
- `app/not-found.tsx` : page 404 propre avec bouton retour accueil

### Validation
- `npx tsc --noEmit` ✅
- `npm run build` ✅ — 21 routes

---

## Comment lire ce journal

Chaque entrée date = ce qui a été livré ce jour-là. Si tu reviens dans 2 mois et que tu ne te souviens plus de ce qui marche déjà, lis-moi.
