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

**Pourquoi** : la page `/pricing` montre des plans 49/99/199 EUR mais aucun paiement n'est actuellement collecté.

**Étapes** :
1. Créer un compte Stripe (gratuit) : https://dashboard.stripe.com/register
2. Créer 3 produits : Starter, Pro, Business avec prix mensuels
3. Récupérer les `STRIPE_PUBLISHABLE_KEY` et `STRIPE_SECRET_KEY` dans `.env.local`
4. Installer `stripe` côté Node
5. Créer `/api/billing/checkout` qui crée une Checkout Session
6. Créer `/api/billing/webhook` pour traiter `checkout.session.completed` et activer l'abonnement
7. Ajouter une colonne `subscription_status` dans la table `businesses`

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
