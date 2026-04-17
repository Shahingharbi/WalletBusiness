# STRUCTURE DU PROJET - FidPass MVP

> Next.js 14+ (App Router) + TypeScript + Supabase + Tailwind CSS

---

## Arborescence complete

```
fidpass/
├── .env.local                          # Variables Supabase (NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, etc.)
├── .env.example                        # Template des variables d'env
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg                        # Logo FidPass
│   ├── logo-dark.svg                   # Logo variante sombre
│   ├── iphone-mockup.png              # Frame iPhone pour la preview live
│   └── images/
│       └── placeholder-banner.jpg      # Image par defaut pour les cartes
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Schema BDD complet (depuis database-schema.md)
│   └── seed.sql                        # Donnees de test (super_admin, business demo)
│
├── src/
│   ├── app/                            # === ROUTES (App Router) ===
│   │   ├── layout.tsx                  # Layout racine : providers (Supabase, Theme)
│   │   ├── page.tsx                    # Redirect: si logged → /dashboard, sinon → /login
│   │   ├── globals.css                 # Styles globaux + Tailwind directives
│   │   │
│   │   ├── (auth)/                     # Groupe de routes AUTH (layout sans sidebar)
│   │   │   ├── layout.tsx              # Layout auth : centrage, fond clair, logo
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # Page de connexion (email + mdp)
│   │   │   ├── register/
│   │   │   │   └── page.tsx            # Page d'inscription (prenom, nom, email, mdp, nom du commerce)
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx            # Mot de passe oublie
│   │   │   └── invitation/
│   │   │       └── [token]/
│   │   │           └── page.tsx        # Accepter une invitation employe
│   │   │
│   │   ├── (dashboard)/                # Groupe de routes DASHBOARD (layout avec sidebar)
│   │   │   ├── layout.tsx              # Layout dashboard : sidebar + topbar + contenu
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # Dashboard principal : KPIs, graphiques basiques
│   │   │   ├── cards/
│   │   │   │   ├── page.tsx            # Liste des cartes (grille avec mockups iPhone)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx        # Wizard creation carte (3 etapes)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx        # Detail carte : preview + QR code
│   │   │   │       ├── edit/
│   │   │   │       │   └── page.tsx    # Editeur carte (memes 3 etapes)
│   │   │   │       ├── clients/
│   │   │   │       │   └── page.tsx    # Clients de cette carte
│   │   │   │       └── stats/
│   │   │   │           └── page.tsx    # Stats de cette carte
│   │   │   ├── clients/
│   │   │   │   └── page.tsx            # Base clients globale (tableau)
│   │   │   └── settings/
│   │   │       └── page.tsx            # Parametres du compte (profil, business)
│   │   │
│   │   ├── (scanner)/                  # Groupe de routes SCANNER (layout minimaliste mobile)
│   │   │   ├── layout.tsx              # Layout scanner : header simple, pas de sidebar
│   │   │   └── scanner/
│   │   │       └── page.tsx            # App scanner : camera + affichage resultat scan
│   │   │
│   │   ├── (public)/                   # Groupe de routes PUBLIQUES (pas d'auth)
│   │   │   ├── layout.tsx              # Layout public : minimal, branded
│   │   │   └── c/
│   │   │       └── [token]/
│   │   │           └── page.tsx        # Page d'installation carte client (scanne le QR)
│   │   │                               # Affiche la carte, boutons "Ajouter au wallet"
│   │   │
│   │   ├── (admin)/                    # Groupe de routes SUPER ADMIN
│   │   │   ├── layout.tsx              # Layout admin : sidebar admin specifique
│   │   │   └── admin/
│   │   │       └── page.tsx            # Dashboard admin : tous les businesses, stats globales
│   │   │
│   │   └── api/                        # === API ROUTES ===
│   │       ├── auth/
│   │       │   └── callback/
│   │       │       └── route.ts        # Callback Supabase Auth (email confirm, OAuth)
│   │       ├── cards/
│   │       │   ├── route.ts            # POST: creer une carte
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET/PUT/DELETE une carte
│   │       │       ├── qr/
│   │       │       │   └── route.ts    # GET: generer le QR code (image PNG)
│   │       │       └── activate/
│   │       │           └── route.ts    # POST: activer la carte
│   │       ├── scan/
│   │       │   └── route.ts            # POST: scanner une carte client (ajouter tampon)
│   │       ├── redeem/
│   │       │   └── route.ts            # POST: utiliser une recompense
│   │       ├── clients/
│   │       │   └── route.ts            # GET: liste clients, POST: creer client
│   │       ├── install/
│   │       │   └── [token]/
│   │       │       └── route.ts        # POST: installer une carte (cree card_instance + client)
│   │       ├── invitations/
│   │       │   └── route.ts            # POST: envoyer une invitation employe
│   │       ├── upload/
│   │       │   └── route.ts            # POST: upload image (logo, banniere)
│   │       └── stats/
│   │           └── route.ts            # GET: stats dashboard (KPIs)
│   │
│   ├── components/                     # === COMPOSANTS REUTILISABLES ===
│   │   ├── ui/                         # Composants UI generiques (shadcn/ui style)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── dropdown.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   └── avatar.tsx
│   │   │
│   │   ├── layout/                     # Composants de layout
│   │   │   ├── sidebar.tsx             # Sidebar navigation (icones + labels)
│   │   │   ├── topbar.tsx              # Top bar (logo, user menu)
│   │   │   └── mobile-nav.tsx          # Navigation mobile (hamburger)
│   │   │
│   │   ├── cards/                      # Composants lies aux cartes
│   │   │   ├── card-preview.tsx        # Preview live dans mockup iPhone
│   │   │   ├── card-grid.tsx           # Grille de cartes (page liste)
│   │   │   ├── card-editor/
│   │   │   │   ├── step-type.tsx       # Etape 1 : selection type (pre-selectionne Tampon)
│   │   │   │   ├── step-settings.tsx   # Etape 2 : parametres (nb tampons, recompense, barcode)
│   │   │   │   └── step-design.tsx     # Etape 3 : design (logo, couleurs, images)
│   │   │   ├── stamp-display.tsx       # Affichage des tampons (cercles actifs/inactifs)
│   │   │   └── qr-display.tsx          # Affichage du QR code
│   │   │
│   │   ├── clients/                    # Composants lies aux clients
│   │   │   ├── clients-table.tsx       # Tableau des clients
│   │   │   └── client-detail.tsx       # Detail d'un client (historique tampons)
│   │   │
│   │   ├── scanner/                    # Composants du scanner
│   │   │   ├── camera-scanner.tsx      # Composant camera + detection barcode/QR
│   │   │   └── scan-result.tsx         # Affichage du resultat du scan (+1 tampon, recompense, etc.)
│   │   │
│   │   ├── dashboard/                  # Composants du dashboard
│   │   │   ├── kpi-card.tsx            # Card KPI (nombre + label)
│   │   │   └── stats-chart.tsx         # Graphique simple (barres ou lignes)
│   │   │
│   │   └── install/                    # Composants de la page d'installation client
│   │       ├── install-card.tsx        # Vue de la carte pour le client final
│   │       └── wallet-buttons.tsx      # Boutons "Ajouter a Apple/Google Wallet"
│   │
│   ├── lib/                            # === LOGIQUE METIER & UTILITAIRES ===
│   │   ├── supabase/
│   │   │   ├── client.ts               # Client Supabase cote navigateur
│   │   │   ├── server.ts               # Client Supabase cote serveur (RSC, API routes)
│   │   │   ├── middleware.ts            # Client Supabase pour le middleware
│   │   │   └── admin.ts                # Client Supabase admin (service_role, pour les fonctions server-only)
│   │   │
│   │   ├── qr.ts                       # Generation de QR codes (librairie qrcode)
│   │   ├── barcode.ts                  # Generation PDF417 (si necessaire)
│   │   ├── upload.ts                   # Upload d'images vers Supabase Storage
│   │   ├── slug.ts                     # Generation de slugs URL-friendly
│   │   ├── tokens.ts                   # Generation de tokens securises
│   │   ├── constants.ts                # Constantes (types de cartes, roles, limites)
│   │   ├── validations.ts              # Schemas de validation (Zod)
│   │   └── utils.ts                    # Fonctions utilitaires (formatDate, cn, etc.)
│   │
│   ├── hooks/                          # === HOOKS REACT CUSTOM ===
│   │   ├── use-user.ts                 # Hook: user courant + profil + business
│   │   ├── use-cards.ts                # Hook: CRUD cartes
│   │   ├── use-clients.ts              # Hook: liste clients
│   │   └── use-scanner.ts              # Hook: logique du scanner (camera, scan, resultat)
│   │
│   ├── types/                          # === TYPES TYPESCRIPT ===
│   │   ├── database.ts                 # Types generes depuis Supabase (supabase gen types)
│   │   ├── card.ts                     # Types metier pour les cartes
│   │   └── index.ts                    # Re-exports
│   │
│   └── middleware.ts                   # Middleware Next.js : protection des routes, redirection auth
│
└── docs/                               # Documentation
    ├── boomerangme-analysis.md          # Analyse UX de BoomerangMe
    ├── database-schema.md              # Ce document
    ├── project-structure.md            # Ce document
    └── roadmap.md                      # Roadmap de developpement
```

---

## Description des groupes de routes

### `(auth)` - Pages d'authentification
- **Sans sidebar**, layout minimal avec logo FidPass centre
- Accessible uniquement si NON connecte (sinon redirect vers /dashboard)
- Pages: login, register, forgot-password, invitation

### `(dashboard)` - Dashboard commercant
- **Avec sidebar** et topbar
- Accessible uniquement si connecte ET role = business_owner
- C'est le coeur de l'app pour le commercant
- Pages: dashboard, cards, clients, settings

### `(scanner)` - App scanner employe
- **Layout mobile-first**, pas de sidebar, header minimaliste
- Accessible si connecte ET role = employee
- Une seule page: le scanner camera + resultat

### `(public)` - Pages publiques
- **Pas d'auth requise**
- La page `/c/[token]` est la page que le client final voit quand il scanne le QR code
- Design branded, mobile-first

### `(admin)` - Dashboard super admin
- Accessible uniquement si role = super_admin
- Dashboard avec vue globale sur tous les businesses

---

## Dependances principales

```json
{
  "dependencies": {
    "next": "^15",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.5",
    "qrcode": "^1.5",
    "zod": "^3.23",
    "lucide-react": "^0.400",
    "tailwind-merge": "^2",
    "clsx": "^2",
    "date-fns": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/qrcode": "^1",
    "tailwindcss": "^3",
    "supabase": "^1"
  }
}
```

---

## Middleware : protection des routes

```
/login, /register         → accessible si NON connecte
/dashboard/*              → accessible si connecte + business_owner
/scanner/*                → accessible si connecte + employee
/admin/*                  → accessible si connecte + super_admin
/c/*                      → accessible par tous (public)
/api/*                    → auth verifiee dans chaque route handler
```
