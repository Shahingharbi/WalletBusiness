# Journal de build FidPass

> Trace de ce qui est livré chaque jour. Pour ta mémoire et la mienne.
> Le plus récent en premier.

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
