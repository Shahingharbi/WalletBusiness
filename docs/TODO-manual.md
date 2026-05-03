# Actions manuelles à faire (hors scope autonome)

Ces étapes nécessitent des comptes payants ou des actions hors du codebase.

## 1. Apple Wallet réel (.pkpass)

**Pourquoi** : actuellement la "carte client" passe par une page web (PWA). Pour générer une vraie carte Apple Wallet native, Apple impose un certificat signé.

**Étapes** :
1. Souscrire au programme Apple Developer (99 USD/an) : https://developer.apple.com/programs/
2. Créer un Pass Type ID : https://developer.apple.com/account/resources/identifiers/list/passTypeId
3. Générer le certificat .p12 et noter le mot de passe
4. Installer la lib `passkit-generator` côté Node : `npm i passkit-generator`
5. Créer une route `/api/cards/[id]/pass.pkpass` qui retourne le pass signé
6. Ajouter le bouton "Ajouter à Apple Wallet" sur `/c/[token]/status/[instanceToken]`

## 2. Google Wallet réel (JWT)

**Pourquoi** : pareil pour Android/Google Wallet — il faut un compte Google Pay & Wallet Console.

**Étapes** :
1. Créer un compte Google Pay & Wallet Console : https://pay.google.com/business/console
2. Créer un service account et télécharger la clé JSON
3. Créer une `LoyaltyClass` via l'API Google Wallet
4. Côté Node, signer un JWT avec la clé pour générer le lien "Save to Google Wallet"
5. Ajouter le bouton sur `/c/[token]/status/[instanceToken]`

## 3. Stripe billing — Tarifs mai 2026

**Statut code** : tout le flow est implémenté (checkout, webhook idempotent, customer portal, gating par plan, page `/settings/billing`, banner d'essai 30 jours). Il ne reste qu'à créer les produits côté Stripe et coller les 6 price IDs.

**Mise à jour mai 2026** : nouveaux tarifs (29 / 59 / 129 €) + 30 jours d'essai (au lieu de 14) + Enterprise sur devis (pas de price Stripe — vente assistée via `mailto:contact@aswallet.fr`).

**Étapes — à suivre dans l'ordre** :

1. **Créer un compte Stripe** (gratuit) : https://dashboard.stripe.com/register puis activer le mode test (toggle en haut à droite) pour le dev.

2. **Appliquer les migrations SQL** dans cet ordre via le SQL Editor Supabase :
   - `supabase/migrations/002_billing.sql` — colonnes `subscription_*` + table `stripe_events` (déjà appliquée historiquement).
   - `supabase/migrations/009_intended_plan.sql` — colonnes `intended_plan` / `intended_interval` (déjà appliquée le 2026-05-02 via Management API).
   - `supabase/migrations/010_extended_trial.sql` — passe le trigger `handle_new_user` à 30 jours d'essai (au lieu de 14) et étend les essais en cours de +16j. **À appliquer manuellement** : copie-colle ce fichier dans SQL Editor → Run.

3. **Créer 3 produits dans Stripe** (Dashboard → *Products* → *Add product*). Pour chaque produit, créer **2 prix récurrents** (mensuel + annuel facturé en une fois) :

   | Produit  | Prix mensuel        | Prix annuel             | Total annuel |
   |----------|---------------------|-------------------------|--------------|
   | Starter  | 29 EUR /mois        | 264 EUR /an             | 264 EUR      |
   | Pro      | 59 EUR /mois        | 528 EUR /an             | 528 EUR      |
   | Business | 129 EUR /mois       | 1164 EUR /an            | 1164 EUR     |

   Pour chaque prix créé, copier le `price_id` (commence par `price_...`) — tu vas en avoir 6 au total.

   ⚠️ **Pas de produit Enterprise** : c'est une vente assistée. Le bouton "Contacter les ventes" sur la landing ouvre simplement `mailto:contact@aswallet.fr?subject=Demande%20Enterprise%20aswallet`.

4. **Coller les 6 price IDs** dans `.env.local` (ou Vercel) avec exactement ces noms :

   ```
   STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
   STRIPE_PRICE_ID_STARTER_ANNUAL=price_...
   STRIPE_PRICE_ID_PRO_MONTHLY=price_...
   STRIPE_PRICE_ID_PRO_ANNUAL=price_...
   STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_...
   STRIPE_PRICE_ID_BUSINESS_ANNUAL=price_...
   ```

   Note : le code accepte aussi les anciens noms `_MONTH` / `_YEAR` (rétro-compat) mais on recommande d'utiliser les nouveaux `_MONTHLY` / `_ANNUAL` qui matchent la copie UI ("Mensuel / Annuel").

5. **Récupérer les clés API** dans Stripe → *Developers* → *API keys*. Copier `Secret key` (sk_test_...) et `Publishable key` (pk_test_...). Les coller dans `.env.local` (les noms sont déjà listés dans `.env.example`).

6. **Configurer le webhook** : Stripe → *Developers* → *Webhooks* → *Add endpoint*.
   - URL : `https://aswallet.fr/api/billing/webhook` (en local : utiliser `stripe listen --forward-to localhost:3000/api/billing/webhook` qui imprime un `whsec_...`).
   - Events à sélectionner : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copier le `Signing secret` (whsec_...) dans `STRIPE_WEBHOOK_SECRET`.

7. **Activer le Customer Portal** : Stripe → *Settings* → *Billing* → *Customer portal*. Activer ; cocher "Allow customers to cancel subscriptions" et "Update payment methods".

8. **Vercel** : ajouter au total 9 variables d'env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, et les 6 `STRIPE_PRICE_ID_*` listés ci-dessus). Redéployer.

9. **Tester** : avec une carte test (`4242 4242 4242 4242`, n'importe quelle date + CVC), depuis la landing page cliquer "Démarrer l'essai gratuit" sur la carte Pro, créer le compte, attendre la fin du trial OU cliquer "Configurer le paiement" depuis le banner du dashboard, terminer le checkout, vérifier que `businesses.subscription_status = 'active'` et que `subscription_plan` = `pro` côté DB.

## 4. Email transactionnel (confirmation, invitations)

**Pourquoi** : actuellement les invitations employés génèrent un lien que tu copies-colles manuellement. Pour envoyer le lien par email automatiquement :

**Option A — Resend (le plus simple, gratuit jusqu'à 3000 emails/mois)** :
1. Créer un compte : https://resend.com
2. Vérifier ton domaine (DNS records)
3. Récupérer la clé API et la mettre dans `.env.local` : `RESEND_API_KEY=...`
4. `npm i resend`
5. Modifier `/api/invitations` pour envoyer l'email après l'insert

**Option B — Mailgun** (déjà mentionné dans la roadmap mais plus compliqué)

## 5. SMS Twilio (optionnel)

Pour notifier les clients par SMS quand leur récompense est débloquée :
1. Créer un compte Twilio : https://www.twilio.com
2. Acheter un numéro français
3. `npm i twilio`
4. Créer une fonction d'envoi SMS

## 6. Domaine custom + déploiement Vercel

1. ~~Acheter un domaine~~ **Fait : `aswallet.fr` acheté chez IONOS le 2026-04-21**
2. ~~Pousser le repo~~ **Fait : déployé sur Vercel depuis GitHub**
3. ~~Connecter le repo à Vercel~~ **Fait : `wallet-business-blond.vercel.app`**
4. Configurer les variables d'env Vercel :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = `https://aswallet.fr`
5. Pointer le DNS du domaine vers Vercel
6. Vérifier que la caméra QR scanner marche (HTTPS requis, ne fonctionne PAS en HTTP non-localhost)

## 7. Bucket Supabase + RLS storage

Vérifier dans le dashboard Supabase que les buckets `card-assets` et `business-assets` sont bien `public` et que les policies storage RLS sont actives. Si l'upload échoue avec "row level security", recharger la migration `001d_rls_storage.sql`.

## 8. Apple Developer + Google Play (déploiement futur app native)

Si tu veux distribuer une app scanner native (au lieu de la webapp `/scanner`) :
- Apple Developer Program (99 USD/an)
- Google Play Console (25 USD une fois)
- Réécrire le scanner en React Native ou utiliser Capacitor pour wrapper la webapp

## Apple Wallet — Live updates (PassKit Web Service + APNs)

**Statut code** : entièrement implémenté.
- Migration `005_apple_pass_devices.sql` appliquée (table `apple_pass_devices`).
- 4 endpoints PassKit sous `/api/apple-wallet/v1/*` (register / unregister / list-updates / get-pass / log).
- `pushAppleWalletUpdate()` (`src/lib/apple-wallet-push.ts`) appelé fire-and-forget depuis `/api/scan` après `syncLoyaltyObject`.
- Env `APPLE_WALLET_AUTH_SECRET` ajouté sur Vercel (production/preview/development).

**Hypothèse de cert APNs** : ce code suppose que le `.p12` Pass Type ID actuel
(`APPLE_WALLET_SIGNER_CERT_BASE64` / `APPLE_WALLET_SIGNER_KEY_BASE64`) peut être
réutilisé tel quel comme cert client TLS pour APNs (`api.push.apple.com:443`).
C'est le comportement standard documenté par Apple : un Pass Type ID certificate
est valable comme TLS cert pour les push notifications PassKit.

**À vérifier en production** : déployer, ajouter un pass à un iPhone, scanner
un tampon et observer les logs Vercel. Deux scénarios d'échec possibles :
1. Si les logs montrent `[apple-wallet-push] APNs session error: ... DEPTH_ZERO_SELF_SIGNED_CERT` ou un handshake TLS qui échoue, c'est que le `.p12` actuel n'inclut pas la chaîne complète. Solution : régénérer le cert depuis le portail Apple Developer en exportant la **chaîne** (cert + intermédiaires Apple) dans le `.p12`.
2. Si les logs montrent `status=403 reason=InvalidProviderToken` ou `BadCertificate`, c'est que ce cert n'est pas autorisé pour APNs. Solution : créer (gratuit, pas un cert séparé payant) un nouveau Pass Type ID dans le portail Apple Developer en cochant explicitement "APNs" — ou utiliser le mode token-based JWT (clé `.p8` au lieu de cert), à éviter ici car cela demande une refonte du push helper.

**Pas d'env supplémentaire** : seuls les env existants + `APPLE_WALLET_AUTH_SECRET`
(déjà en place) sont nécessaires.

**Test end-to-end manuel à faire après déploiement** :
1. Sur un iPhone (iOS 14+), ouvrir une carte client (`/c/{token}/status/{instanceToken}`), cliquer "Ajouter à Apple Wallet". Vérifier que le pass s'installe.
2. Côté serveur (Supabase) : `SELECT * FROM apple_pass_devices` → la row doit apparaître quelques secondes après l'install (iOS POST register).
3. Depuis le scanner web, scanner un tampon. Le pass sur l'iPhone doit se mettre à jour automatiquement (compteur "X / Y" et strip image rafraîchis) en quelques secondes.
4. Si KO : ouvrir Console.app sur Mac avec l'iPhone branché et filtrer par "PassKit" ; les erreurs `Apple` (e.g. signing, web service unreachable) y apparaissent.

## 9. Google OAuth ("Continuer avec Google")

**Pourquoi** : le code a un bouton "Continuer avec Google" sur `/login` et `/register` (flow PKCE via `@supabase/ssr`, callback sur `/auth/callback`). Pour qu'il fonctionne il faut activer le provider Google côté Supabase et créer les credentials OAuth côté Google Cloud.

**Étapes** :

1. **Google Cloud Console** — créer les credentials OAuth :
   - Aller sur https://console.cloud.google.com/apis/credentials
   - Créer (ou réutiliser) un projet.
   - `OAuth consent screen` → External → renseigner nom d'app `aswallet`, support email, domaine autorisé `aswallet.fr`.
   - `Credentials` → `Create Credentials` → `OAuth client ID` → `Web application`.
   - **Authorized JavaScript origins** :
     - `https://aswallet.fr`
     - `https://wallet-business-blond.vercel.app`
     - `http://localhost:3000`
   - **Authorized redirect URI** (obligatoire, pointe sur Supabase, pas sur aswallet) :
     - `https://<TON-PROJECT-REF>.supabase.co/auth/v1/callback`
     - (Le `<TON-PROJECT-REF>` est la partie avant `.supabase.co` dans `NEXT_PUBLIC_SUPABASE_URL`.)
   - Copier le `Client ID` et le `Client Secret`.

2. **Supabase Dashboard** — activer Google :
   - `Authentication` → `Providers` → `Google` → toggle **Enabled**.
   - Coller le `Client ID` et le `Client Secret`.
   - Sauvegarder.

3. **Supabase Dashboard** — URL config :
   - `Authentication` → `URL Configuration`.
   - **Site URL** : `https://aswallet.fr`
   - **Redirect URLs** (ajouter toutes les valeurs, une par ligne) :
     - `https://aswallet.fr/auth/callback`
     - `https://wallet-business-blond.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`

4. **Rien à faire côté env** : aucun env var supplémentaire. Le PKCE flow passe par les cookies Supabase existants.

5. **Profile + business auto** : le trigger SQL `handle_new_user` (dans `supabase/migrations/001c_functions.sql`) crée déjà les rows `profiles` + `businesses` au premier sign-in. Pour les users Google, `raw_user_meta_data.business_name` est absent → le business est nommé "Mon Commerce" par défaut. Le user peut le renommer ensuite dans `/settings`.

6. **Test** :
   - Local : `npm run dev`, aller sur `http://localhost:3000/login`, cliquer "Continuer avec Google", vérifier redirect sur `/dashboard` et que `businesses` + `profiles` ont bien une row.
   - Prod : idem sur `https://aswallet.fr/login`.

## QA findings 2026-05-02 (passe pré-démo)

Audit complet avant la démo merchants. Les bugs critiques sont déjà corrigés
en code (voir commit lié). Cette section liste ce qui reste à régler.

### CRITIQUE — flow de réinitialisation de mot de passe cassé

`/forgot-password` envoie l'email Supabase qui redirige vers `/api/auth/callback`
puis `/dashboard`. Il n'existe **aucune page** où l'utilisateur peut saisir un
nouveau mot de passe. Conséquence : un user qui clique sur "Mot de passe
oublié" reçoit l'email, clique le lien, mais arrive sur le dashboard
**toujours avec son ancien mot de passe oublié**.

**Action** : créer `src/app/(auth)/reset-password/page.tsx` avec :
- Champs `password` + `confirm_password` + bouton submit
- `supabase.auth.updateUser({ password })` après vérification de la session
- Au montage : si pas de session, rediriger vers `/login` avec message d'erreur
- Côté `/forgot-password`, changer `redirectTo` pour `${origin}/reset-password`
- Côté Supabase Dashboard → Auth → URL Configuration : ajouter
  `https://aswallet.fr/reset-password` aux Redirect URLs.

### CRITIQUE — pas d'i18n dans les messages d'erreur Supabase

Les pages auth catchent maintenant les erreurs courantes (Invalid login,
Email not confirmed, User already registered, rate limit) et les
traduisent. Mais `forgot-password` et l'invitation `accept-form` retournent
encore le message anglais brut de Supabase. Solution future : créer un
helper `translateAuthError(err: AuthError): string` réutilisable dans
`src/lib/auth-errors.ts`.

### HIGH — Wizard de création de carte : étape "Type" après "Modèle"

Sur `/cards/new`, l'ordre des étapes est `Modèle → Type → Paramètres → Design`.
Quand on choisit un template à l'étape 1, le `card_type` du template est
écrasé par l'étape 2 si l'utilisateur change. Pas un bug, mais
contre-intuitif : on peut choisir un template "Café tampons" puis sélectionner
"Cashback" à l'étape 2. À tester avec un merchant : confusion possible.

### HIGH — pas de détection iOS/Android sur la page status

`/c/[token]/status/[instanceToken]` affiche **les deux** boutons "Ajouter à
Apple Wallet" + "Ajouter à Google Wallet" en parallèle. Les utilisateurs
peuvent cliquer sur Apple Wallet depuis Android (échec : .pkpass
incompatible) ou Google Wallet depuis iOS. Solution : détecter le UA
côté serveur (`headers().get('user-agent')`) et masquer le bouton
inadapté. Garder un fallback "Voir l'autre option" si le merchant veut
tester l'autre plateforme.

### HIGH — page `/admin` dans le matcher mais pas implémentée

`src/middleware.ts` ligne 50 inclut `/admin` dans `protectedRoutes` mais
le dossier `src/app/(admin)/admin/` est vide. Si un user tape
`/admin` connecté, il reçoit un 404 (pas grave) mais le code mort
laisse penser qu'il y a une fonctionnalité. À retirer du middleware.

### HIGH — search dans `/clients` permet une injection .or()

`src/app/(dashboard)/clients/page.tsx` ligne 44 :
```ts
query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
```
Le `search` n'est pas escapé. Un user (authentifié, avec son business_id)
pourrait casser le filtre avec une virgule ou un guillemet. Risque
limité (RLS protège `business_id`) mais à corriger en escape via
`%`-encoding ou en passant par 3 `.ilike()` séparés combinés
manuellement. Document : pas critique pour la démo.

### MEDIUM — JSON-LD Product offers pointe vers `/pricing` (corrigé en `/#pricing`)

`src/app/page.tsx` exposait `${SITE_URL}/pricing` dans le schema.org
Product, mais cette route n'existe pas. Corrigé pour pointer sur la
section ancrée de la landing.

### MEDIUM — emails reward-earned avec URL cassée (corrigé)

`/api/scan/route.ts` envoyait `walletUrl: ${appUrl}/c/wallet/${instanceToken}`
qui résolvait sur `/c/[token]` (token = "wallet") avec un suffixe orphelin
→ 404. Corrigé pour `/c/[cardId]/status/[instanceToken]`. Idem dans
`/api/install/[token]/route.ts` qui utilisait `businessId` au lieu de
`cardId`.

### MEDIUM — accents manquants dans tout le projet

Une passe a été faite : tous les `Non authentifie`, `creation`, `mise a jour`,
`Reessayez`, `Propulse par`, `Carte de fidelite`, etc. sont corrigés dans
les API routes `business`, `cards`, `cards/[id]`, `cards/[id]/activate`,
`profile`, `onboarding/answers`, `onboarding/complete`, `onboarding/poster`,
`rate-limit.ts`, `(auth)/login/page.tsx`, `(auth)/register/page.tsx`,
`google-auth-button.tsx`, `(public)/layout.tsx`. Le PDF `affiche-{nom}.pdf`
généré par le poster route est désormais lisible avec accents (`fidélité`,
`récompense`, `télécharger`, `téléphone`, `propulsé par`, etc.).

Reste à vérifier : si un commerçant entre lui-même un nom avec accents
dans `reward_text`, le PDF Helvetica de @react-pdf/renderer le supporte
en WinAnsi. Tester `Café offert !` → doit s'afficher correctement.

### MEDIUM — install/api 409 (déjà installée) renvoie maintenant l'utilisateur sur sa carte (corrigé)

Avant : le user voyait juste un message d'erreur "Vous avez déjà cette carte".
Maintenant : redirection automatique sur `/c/[cardId]/status/[instanceToken]`.

### LOW — `setInterval` shadow dans PricingSection

`src/components/landing/PricingSection.tsx` ligne 83 :
```ts
const [interval, setInterval] = useState<BillingInterval>("month");
```
Le setter `setInterval` masque le global `setInterval`. Pas de bug
dans ce composant (on ne l'utilise pas) mais ESLint pourrait warner.
Renommer `setBillingInterval` post-démo.

### LOW — Avatar seed `Amelie` sans accent (HeroSection.tsx)

Hero section utilise `["Karim", "Amelie", "Mehdi", ...]` pour les
DiceBear avatars. Cosmétique, ne bloque pas.

### LOW — TODO comments laissés dans le code

- `src/lib/rate-limit.ts:13` : migration vers Upstash Redis post-MVP.
- `src/components/landing/TestimonialsSection.tsx:3` : remplacer fake
  testimonials par de vrais (10 premiers commerçants).
- `src/components/landing/StickyMobileCTA.tsx:12` : exit-intent popup desktop.
- `src/app/api/campaigns/route.ts:218` : APNs push pour campagnes (cert APNs
  requis, prévu en phase 2).

### LOW — fallback `localhost:3000` pour `NEXT_PUBLIC_APP_URL` non défini

Trois endroits gardent `http://localhost:3000` en fallback si la variable
n'est pas définie : `src/app/api/billing/portal/route.ts:51`,
`src/app/api/billing/checkout/route.ts:88`, `src/app/(dashboard)/cards/[id]/page.tsx:54`.
En prod sur Vercel la variable est forcément set, donc OK pour la démo.
À durcir : `throw new Error("NEXT_PUBLIC_APP_URL not set")` dans `lib/env.ts`.

### LOW — pages `(dashboard)/cards/[id]/edit/`, `(dashboard)/cards/[id]/clients/`, `(dashboard)/cards/[id]/stats/`, `(dashboard)/cards/[id]/campaigns/`, `(dashboard)/clients/[id]/`, `(auth)/invitation/[token]/` non auditées en détail dans cette passe

Ces sous-pages compilent (build verte) et ont l'air conventionnelles
mais n'ont pas été lues ligne par ligne. Si un bug se manifeste pendant
la démo, regarder en priorité `cards/[id]/edit` (le merchant va sûrement
modifier sa carte test).

