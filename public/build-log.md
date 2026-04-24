# Journal de build aswallet (ex-FidPass)

> Trace de ce qui est livré chaque jour. Pour ta mémoire et la mienne.
> Le plus récent en premier.

---

## 2026-04-23 — Production polish : security, RGPD, Google Wallet live sync, CRO, responsive, accents

### Google Wallet : carte live + tampons visuels (technique Boomerangme)
- **Sync automatique après scan** — `lib/google-wallet.ts` : nouvelle fonction `syncLoyaltyObject(token, stamps, rewards, appUrl)` qui PATCH `/loyaltyObject/{id}` via service account. Appelée depuis `api/scan/route.ts` après chaque tampon ajouté. Silencieux sur 404 (user n'a pas ajouté la carte au Wallet) + timeout 3s.
- **heroImage dynamique par instance** — nouveau endpoint `src/app/api/wallet/banner/[instanceToken]/[count]/route.tsx` qui rend un **PNG 1032×336** via Next `ImageResponse` (`next/og`). Grid de tampons **matchant la preview de l'app** : shape (circle / squircle / shield / star / hex) en SVG inline, icône (14 variants de `lib/stamp-icons.tsx` inlinées : check, star, heart, coffee, pizza, flower, scissors, crown, leaf, gift, baguette, kebab, diamond, sparkle). Si le commerçant a uploadé `stamp_active_url` / `stamp_inactive_url`, ce sont eux qui s'affichent.
- **URL = cache-buster** : le `count` dans le path change à chaque scan → Google refetch → le wallet affiche le nouveau visuel en live.
- **Contraintes Satori respectées** : flexbox only, SVG inline, pas de `clip-path` / `mask` / grid CSS.
- **DB source de vérité** : le `count` URL sert uniquement au cache-bust ; le renderer lit toujours `stamps_collected` depuis Supabase.
- **Fallback logo obligatoire** — `lib/google-wallet.ts` : si le commerçant n'a pas de logo, fallback automatique sur `https://aswallet.fr/icon.svg` (sinon Google refuse la création de class avec "LoyaltyClass cannot be created without a program logo" — c'était le bug "erreur est survenue" au Save final, 11 cartes sur 15 étaient cassées).
- **Pré-création des classes** — nouveau script `scripts/sync-wallet-classes.mjs` : itère toutes les cartes Supabase et crée la class Google Wallet correspondante via l'API (POST `/loyaltyClass`). Plus fiable que le JWT-embedded insert. Run une fois = 15/15 classes APPROVED.
- **Scripts diag** : `scripts/list-classes.mjs`, `scripts/debug-card-class.mjs`, `scripts/promote-classes.mjs` (DRAFT → UNDER_REVIEW).

### Security baseline SaaS
- **Headers** (`next.config.ts`) : HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (camera self, micro/geo/payment off), CSP en **Report-Only** (TODO : flip en enforcing après vérif).
- **Rate limiting in-memory** (`lib/rate-limit.ts`) : sliding window per-IP. Appliqué sur `/api/upload` (20/min), `/api/redeem` (20/min), `/api/install/[token]` (5/min), `/api/invitations/[token]/accept` (5/min). Module-scoped Map — migrable vers Upstash Redis plus tard.
- **Env guard** (`lib/env.ts`) : validation des 7 env vars obligatoires au runtime prod (avertit hors prod, ne bloque pas le build CI).
- **SEO baseline** : `src/app/robots.ts` (disallow `/api/`, `/dashboard/`, etc. + lien sitemap) + `src/app/sitemap.ts` (pages publiques seulement).
- **Error boundary global** (`src/app/error.tsx`) : copy FR propre, plus de stacktrace en prod.

### RGPD / CNIL full compliance
- **`/mentions-legales`** (NEW, LCEN) : éditeur Shahin Gharbi SIRET 903 950 210 00026, hébergeur Vercel (USA), hébergement DB Supabase (EU Irlande), TVA non-assujetti.
- **`/privacy`** : rewrite complet — tableau finalités / bases légales / durées (art. 6 RGPD), liste sous-traitants (Supabase, Vercel, Google, IONOS) avec SCCs, 8 droits RGPD, CNIL.
- **`/terms`** : ajout art. 7 (responsable vs sous-traitant art. 28 RGPD, DPA sur demande) et art. 8 (durée, portabilité, sort des données).
- **`/settings/data`** (dashboard) : bouton **Exporter mes données** (JSON complet download) + bouton **Supprimer mon compte** (confirmation `SUPPRIMER`). APIs `/api/account/export` GET + `/api/account` DELETE.
- **Install form consent** : checkbox consentement obligatoire avant install d'une carte + vérification server-side.
- **Cookie notice** : toast discret one-time dismissible (pas de bannière RGPD lourde car on utilise uniquement des cookies techniques).

### Landing CRO overhaul
- Hero : headline commerce-focused, CTA unique above-the-fold, avatar stack DiceBear, trust line "14 jours sans CB". Bouton "Voir un exemple" (mort) remplacé par "Voir une démo" qui scroll sur `#how-it-works`.
- 3 nouvelles sections : **TrustBar** (🇫🇷 Europe + RGPD + chiffrement), **UseCasesSection** (6 industries avec photos Unsplash halal-friendly : kebab / boulangerie / coiffeur-scissors / pizza / fleurs / VIP + badge metrics), **FAQSection** (8 objections types).
- HowItWorks : connecteurs dashed desktop + flèches mobile, chips "5 min"/"1 min" par étape.
- Pricing : badge "Le + populaire" sur Pro, reassurance shield "Essai 14j sans engagement".
- CTA finale : dark + yellow highlight.
- **SocialProofSection** : marquee infini de 11 vrais logos SVG (Starbucks / McDo / Nike / Adidas / Air France / SNCF / Fnac / IKEA / Carrefour / Zara / Uniqlo) via Simple Icons CDN — **logos en couleur native**, opacity 90%. Plus de "Captain Wallet" cités nulle part.
- Nouvel ordre : Navbar → Hero → TrustBar → SocialProof → WhyWallet → HowItWorks → Features → UseCases → WalletStats → Pricing → FAQ → CTA → Footer.

### Responsive A à Z (mobile-first, 375px)
- `ui/input` + `ui/dropdown` + `ui/button` : `h-11` + `text-base sm:text-sm` (pas de zoom iOS au focus), touch target 44px.
- Dashboard : KPIs cramped → `p-4 sm:p-6`, wizard step indicator compact + `overflow-x-auto`, tabs scrollables, forms stack → `flex-col sm:flex-row`.
- Landing : hero mockup s'affiche en-dessous du copy sur mobile (`order-2 lg:order-1`), tailles fluides (`text-[30px] sm:text-[40px] lg:text-[58px]`), marquee `overflow-hidden`.
- Install flow `/c/[token]` : banner `h-40 sm:h-48`, `max-w-lg mx-auto`, truncate sur noms longs.
- Scanner, auth, settings, card editor, card preview : paddings + gaps + fonts fluides.

### Accents FR (sweep ~90 fichiers)
- Landing + dashboard + auth + légal + scanner + constants + card editor + API errors.
- Mots corrigés : fidélité, proximité, créer, gérer, déjà, après, très, récompense, paramètres, données, commerçant (ç!), employé, téléphone, accès, Chambéry, étape, zéro, même, réel, fonctionnalités, spécifique, sécurité, activité, durée, expérience, dernière, numéro, télécharger, nécessaire, vérifier, autorisé, complet/complète, légal/légale, éditeur, déconnexion, réservation, rétention, délai, été, Éditeur, etc.

### Google OAuth login/register
- `src/components/auth/google-auth-button.tsx` + `src/app/auth/callback/route.ts` (exchange code for session + guard open-redirect).
- Provider Google activé côté Supabase via Management API (PATCH `/config/auth`).
- Client ID / Secret Google Cloud + consent screen publié en production.

### Domaine aswallet.fr fully live
- Vercel env `NEXT_PUBLIC_APP_URL=https://aswallet.fr` set sur les 3 environnements.
- DNS IONOS : `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`, records IONOS Default Site supprimés. MX/SPF/DMARC/DKIM mail inchangés.
- Vercel domaines `aswallet.fr` + `www.aswallet.fr` attachés et vérifiés.
- Google Wallet issuer approuvé production par Navya (support team Google Wallet API).
- Business profile Google Pay & Wallet Console mis à jour : Corporate website `https://aswallet.fr`, support URL `https://aswallet.fr/contact`.

### Assets cleanup
- Suppression des 5 SVG template Next (next/vercel/file/globe/window).
- Photo coiffeur (visage) remplacée par photo scissors (halal-friendly).
- `.gitignore` : pattern `.tmp-*` pour éviter leak de secrets passés par tmpfiles.

### Validation
- `npx tsc --noEmit` ✅ à chaque commit.
- 8 commits pushés : `8772254` rebrand+OAuth, `36c26f1` wallet finalisation, `8eeb099` fallback logo, `55afb81` security+RGPD+landing cleanup, `1ba870c` CRO landing + sync tampons, `390623c` tampons visuels wallet + LP polish, `3ad0336` responsive LP + wallet banner design, `af807c6` responsive dashboard + accents partiels, `5799f23` accents app-wide.

### À faire (manuel)
- **Apple Wallet** : nécessite Apple Developer Program (99 USD/an, 24–48h approbation), Pass Type ID + cert .p12. Je peux faire tout le code .pkpass + l'export du cert via openssl (pas besoin de Mac), user doit s'inscrire et payer.
- **Mailbox `contact@aswallet.fr`** : à créer côté IONOS (MX déjà en place).
- **Custom SMTP Supabase** pour emails auth (optionnel — amélioration cosmétique des emails de confirmation).
- **Révoquer tokens temporaires** : Vercel PAT + Supabase PAT qui ont transité par la conv (job fait).
- **CSP enforcing** : passer de `Content-Security-Policy-Report-Only` → `Content-Security-Policy` après soak.

---

## 2026-04-21 — Rebrand FidPass → aswallet + domaine aswallet.fr

### Rebrand complet (sans casser le code)
- Nom affiché partout : **aswallet** (minuscule)
- `package.json` + `package-lock.json` : `name` → `aswallet`
- Manifest PWA (`src/app/manifest.ts`) : `name` + `short_name` → `aswallet`
- Layouts (`app/layout.tsx`, `(public)/layout.tsx`, `(auth)/layout.tsx`, `(scanner)/layout.tsx`) : titres, templates et logos textuels
- Composants UI (`sidebar.tsx`, `mobile-nav.tsx`) : brand name
- Landing (`Navbar.tsx`, `Footer.tsx`, `FeaturesSection.tsx`, `HowItWorksSection.tsx`) : brand, email, mockup URL
- Pages legal (`terms`, `privacy`, `contact`) : toutes les mentions + `contact@fidpass.fr` → `contact@aswallet.fr`
- Camera scanner : `REGION_ID` renommé en `aswallet-qr-region`
- Scripts demo (`scripts/create-demo-class.mjs`) : `issuerName` + `programName`
- SQL (`supabase/migrations/001_initial_schema.sql`) : commentaire d'en-tête
- Docs (`CLAUDE.md`, `README.md`, `docs/*`) : titres + mentions mises à jour

### Dossier repo laissé intact
- Le dossier racine s'appelle toujours `fidpass/` → éviter de casser les chemins absolus (CLAUDE path, `.vercel` link, scripts, etc.). Le rebrand est purement cosmétique côté code.

### Domaine & DNS
- Domaine acheté : `aswallet.fr` (IONOS)
- Côté Vercel : ajouter `aswallet.fr` + `www.aswallet.fr` comme custom domains sur le projet `wallet-business`
- Côté IONOS DNS : `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`. Supprimer `AAAA @` + `TXT _dep_ws_mutex` (résidus IONOS Default Site). **Garder** tous les records MX/SPF/DMARC/DKIM (mail).
- Env Vercel à mettre à jour : `NEXT_PUBLIC_APP_URL=https://aswallet.fr`

### Validation
- `npx tsc --noEmit` à relancer après ce rebrand
- `npm run build` à relancer — aucune logique métier touchée, juste des strings

---

## 2026-04-20 — Refonte UX/UI carte wallet + QR/PDF417 + scanner raccourci

### Preview mockup (`card-preview.tsx`) refait de zéro
- Rendu type **Apple Wallet / Google Wallet** (au lieu d'un faux iPhone générique) avec toggle iOS/Android
- **Vrai QR code** généré côté client via `qrcode` npm + `useEffect` (avant : fausses barres `Math.random()` à chaque render)
- **PDF417 en SVG** propre : grille 6×56 cellules, guard-bars symétriques, centré à 85 % du conteneur, `shapeRendering="crispEdges"`. Déterministe (seed depuis la valeur) donc stable au render.
- Overlay gradient automatique sur la bannière pour garantir la lisibilité du texte quelle que soit la photo uploadée
- Calcul `luminance(bg)` pour auto-choisir la couleur de texte (contraste WCAG) sur les accents
- Accepte `barcodeType` en prop, propagé depuis `StepSettings.barcodeType` → la preview change vraiment (bug #1 corrigé)

### Bibliothèque de tampons stylisés
- `lib/stamp-icons.tsx` : 14 icônes SVG inline (check, star, heart, coffee, pizza, flower, scissors, crown, leaf, gift, baguette, kebab, diamond, sparkle)
- `stamp-display.tsx` refait : supporte `iconKey`, `shape` (circle / squircle / shield / star / hex via `clip-path`), `activeImageUrl` / `inactiveImageUrl` pour images custom
- Animation `animate-stamp-pop` appliquée sur les tampons collectés (avant : classe définie mais jamais utilisée)
- `constants.ts` : `DEFAULT_CARD_DESIGN` étendu avec `stamp_icon` et `stamp_shape`

### Images réelles dans les templates
- `lib/card-templates.ts` : **11 templates avec photo Unsplash** (kebab, boulangerie, pizzeria, café, restaurant, institut, pressing, fleuriste, épicerie, vip, remise) — toutes vérifiées 200 OK, **contrainte : aucun visage, aucune awra** (commerce halal-friendly)
- Coiffeur / barbier / scratch laissés sans photo par défaut pour que le commerçant choisisse lui-même (éviter l'écueil du visage)
- La photo est câblée dans `design.banner_url` du template → quand on sélectionne le modèle à l'étape 1, l'aperçu à droite affiche **automatiquement** la photo en bannière avec overlay
- `step-template.tsx` : mini-mockup wallet par template (strip coloré + tampons actifs + code-barres) sur fond photo

### Design step enrichi
- Picker d'icône de tampon (grille 7×2) et de forme (grille 5 : rond / squircle / écusson / étoile / hexagone)
- Uploads "Tampon actif" / "Tampon vide" optionnels (remplacent l'icône si présents)
- Hints explicites : "Un voile sombre sera ajouté pour lisibilité" sur l'upload bannière

### Page détail carte `/cards/[id]`
- **`share-card.tsx`** (nouveau) : remplace le bloc URL qui débordait de l'écran
  - URL tronquée intelligemment via `shortenUrl()` (host + dernier segment compacté : `localhost:3000/c/6e2e…d0e9c`)
  - Bouton **Copier** (navigator.clipboard) avec feedback ✓ + toast
  - Bouton **Partager** (navigator.share sur mobile, fallback copie)
  - Bouton **Ouvrir** (target=_blank)
- **`activate-button.tsx`** (nouveau) : bouton client-side avec `fetch` + toast + `router.refresh`. Avant : `<form method="POST">` HTML → le navigateur redirigeait vers la réponse JSON brute "carte activée" (bug #7 corrigé)
- L'Info tab affiche maintenant dynamiquement `CARD_TYPES[card_type].label` (avant codé en dur "Tampon")
- Le preview reçoit `businessName` (lu depuis `businesses.name`) et `barcode_type`

### Google Wallet respecte `barcode_type`
- `google-wallet.ts` : nouveau param `barcodeType` → `type: "PDF_417"` si `pdf417`, sinon `"QR_CODE"` (avant codé en dur QR_CODE → bug #1 étendu)
- Route `/api/google-wallet/[instanceToken]` lit `cards.barcode_type` et le passe

### Status page public `/c/[token]/status/[instanceToken]`
- Header avec bannière + double overlay (accent gradient + dark) pour garantir contraste sur photo
- Ring blanc sur le logo (`ring-2 ring-white/30`) pour un rendu plus premium
- `StampDisplay` reçoit `iconKey`, `shape`, `activeImageUrl`, `inactiveImageUrl` du design

### Edit form
- Migration des messages inline rouge/vert vers `useToast()`
- Passe `barcodeType` au preview

### Scanner accessible en 1 clic
- **CTA noir "Scanner" dans le topbar** (visible sur toutes les pages dashboard, icône `ScanLine`)
- Entrée dédiée dans la sidebar desktop (highlight noir, position entre Cartes et Clients)
- Entrée identique dans la mobile-nav

### Validation
- Dev server compile à chaque édition ✓
- Toutes les routes répondent 200
- Push `662ae2c` → `origin/main` → Vercel auto-deploy ✓

### Bugs corrigés
- Preview affichait toujours de fausses barres aléatoires, peu importe le type de code choisi → vrai QR / vraie PDF417
- Banner image sans overlay → texte illisible sur image sombre
- URL de partage dépassait l'écran, pas cliquable → bloc avec copy/share/open
- Activation redirigeait vers page JSON brute → bouton client + toast
- Google Wallet ignorait `barcode_type` → respecte le choix utilisateur
- `StampDisplay` props `style={color}` passé à `Icon` qui n'accepte que `className` → `style` remonté sur le wrapper

### À faire (manuellement)
- Quand le domaine perso est prêt : ajouter dans l'`origins` du JWT Google Wallet + notifier `google-wallet-passes-support@google.com`
- Scanner via caméra ne supporte que QR pour l'instant (html5-qrcode) — si besoin PDF417 : évaluer `@zxing/browser` ou `quagga2`

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
