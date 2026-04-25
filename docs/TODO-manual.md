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

## 3. Stripe billing

**Statut code** : tout le flow est implémenté (checkout, webhook idempotent, customer portal, gating par plan, page `/settings/billing`, banner d'essai). Il ne reste qu'à créer les produits côté Stripe et coller les clés.

**Étapes** :

1. **Créer un compte Stripe** (gratuit) : https://dashboard.stripe.com/register puis activer le mode test (toggle en haut à droite) pour le dev.

2. **Appliquer la migration SQL** : copie-colle `supabase/migrations/002_billing.sql` dans le SQL Editor Supabase. Elle ajoute les colonnes `subscription_*` sur `businesses`, met l'essai 14j sur les comptes existants, et crée la table `stripe_events` (idempotence webhook).

3. **Créer 3 produits** dans Stripe Dashboard → *Products* → *Add product*. Pour chaque produit, créer **2 prix récurrents** (monthly + yearly) :
   - Starter : 49 EUR/mois et 39 EUR/mois facturé annuellement (= 468 EUR/an)
   - Pro : 99 EUR/mois et 79 EUR/mois facturé annuellement (= 948 EUR/an)
   - Business : 199 EUR/mois et 159 EUR/mois facturé annuellement (= 1908 EUR/an)
   - Pour chaque prix, copier le `price_id` (commence par `price_...`).

4. **Récupérer les clés API** dans Stripe → *Developers* → *API keys*. Copier `Secret key` (sk_test_...) et `Publishable key` (pk_test_...). Les coller dans `.env.local` (les noms sont déjà listés dans `.env.example`).

5. **Configurer le webhook** : Stripe → *Developers* → *Webhooks* → *Add endpoint*.
   - URL : `https://aswallet.fr/api/billing/webhook` (en local : utiliser `stripe listen --forward-to localhost:3000/api/billing/webhook` qui imprime un `whsec_...`).
   - Events à sélectionner : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copier le `Signing secret` (whsec_...) dans `STRIPE_WEBHOOK_SECRET`.

6. **Activer le Customer Portal** : Stripe → *Settings* → *Billing* → *Customer portal*. Activer ; cocher "Allow customers to cancel subscriptions" et "Update payment methods".

7. **Vercel** : ajouter les 9 variables d'env dans le dashboard Vercel (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, et les 6 `STRIPE_PRICE_ID_*`). Redéployer.

8. **Tester** : avec une carte test (`4242 4242 4242 4242`, n'importe quelle date + CVC), depuis `/settings/billing` cliquer "Souscrire", terminer le checkout, vérifier que `businesses.subscription_status = 'active'` et que `subscription_plan` est correct côté DB.

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
