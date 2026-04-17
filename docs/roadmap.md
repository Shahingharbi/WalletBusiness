# ROADMAP DE DEVELOPPEMENT - FidPass MVP

> Objectif : produit fonctionnel presentable aux premiers commercants en 6-8 semaines
> Stack : Next.js + Supabase + Tailwind + Vercel

---

## PHASE 1 : Fondations (Semaine 1)

**Objectif** : Avoir un squelette d'app fonctionnel avec auth et navigation.

### 1.1 Setup du projet
- Init Next.js 15 + TypeScript + Tailwind
- Configurer Supabase (projet, variables d'env)
- Deployer le schema BDD (migration SQL)
- Seed: creer le super_admin + un business de test
- Premier deploy Vercel (CI/CD)

### 1.2 Authentification
- Page login (email + mot de passe)
- Page register (prenom, nom, email, mdp, nom du commerce)
- Forgot password
- Middleware de protection des routes
- Creation automatique du profil + business a l'inscription
- Redirect selon le role (business_owner → /dashboard, employee → /scanner)

### 1.3 Layout dashboard
- Sidebar avec navigation (icones + labels)
- Top bar (logo, nom du business, user menu, logout)
- Layout responsive (sidebar collapse sur mobile)
- Page dashboard vide avec titre "Tableau de bord"
- Page settings vide

**Livrable** : On peut s'inscrire, se connecter, voir un dashboard vide avec sidebar.

---

## PHASE 2 : Creation de carte Tampon (Semaines 2-3)

**Objectif** : Pouvoir creer, designer et activer une carte de fidelite tampon complete.

### 2.1 Page liste des cartes
- Route /cards
- Affichage des cartes en grille (mockup iPhone)
- Etat vide : "Creez votre premiere carte"
- Bouton "Nouvelle carte"
- Badge de statut (Brouillon / Active / En pause)

### 2.2 Wizard de creation (3 etapes)
**Etape 1 - Type** :
- Selection du type (Tampon pre-selectionne, les autres grisees avec "Bientot")
- Bouton Continuer

**Etape 2 - Parametres** :
- Nombre de tampons (grille 1-30, cliquable)
- Texte de la recompense (input text, ex: "Un kebab offert !")
- Type de barcode (QR / PDF417, radios)
- Expiration (Illimitee / Date fixe / Jours apres installation)
- Bouton Continuer

**Etape 3 - Design** :
- Upload logo (drag & drop + preview)
- Upload image de fond/banniere
- Couleur de fond (color picker)
- Couleur du texte (color picker)
- Couleur d'accent (color picker)
- Labels personnalisables (champs texte)
- Bouton "Enregistrer"

### 2.3 Preview live
- Composant mockup iPhone a droite du formulaire
- Se met a jour en temps reel quand on modifie les champs
- Affiche les tampons (cercles actifs/inactifs)
- Affiche le logo, banniere, couleurs, labels
- Responsive : passe en dessous du formulaire sur mobile

### 2.4 Detail et activation de carte
- Route /cards/[id]
- Vue de la carte en grand avec preview iPhone
- QR code genere (grand, pour impression)
- Bouton "Activer la carte"
- Onglets: Info | Clients | Stats

### 2.5 Upload d'images
- API route pour upload vers Supabase Storage
- Redimensionnement cote client avant upload
- Validation : PNG/JPG, max 3MB
- Retour URL publique

**Livrable** : On peut creer une carte tampon complete avec preview, la personnaliser et l'activer avec un QR code.

---

## PHASE 3 : Page client et installation (Semaine 4)

**Objectif** : Un client peut scanner le QR code et "installer" la carte sur son telephone.

### 3.1 Page publique d'installation
- Route /c/[token] (pas d'auth requise)
- Mobile-first
- Affichage de la carte (design du commercant : logo, banniere, couleurs)
- Formulaire minimal : prenom + telephone (optionnel)
- Boutons d'installation :
  - "Ajouter a Apple Wallet" (simule pour le MVP : cree l'instance + affiche un message)
  - "Ajouter a Google Wallet" (idem)
  - "Ouvrir dans le navigateur" (PWA-like : lien vers une page de suivi)
- Si la carte est inactive ou expiree : message d'erreur

### 3.2 Creation automatique du client
- Quand le client s'installe la carte :
  - Creer le client dans la table clients (si pas deja existant)
  - Creer la card_instance
  - Logger la transaction "card_installed"
  - Generer un token unique pour cette instance

### 3.3 Page de suivi client (PWA)
- Route /c/[token]/status (ou sous-page)
- Le client peut voir son nombre de tampons actuel
- Nombre de recompenses disponibles
- QR code/barcode de sa carte (pour se faire scanner)

**Livrable** : Un client scanne le QR, s'enregistre, et a sa carte virtuelle.

---

## PHASE 4 : Scanner employe (Semaine 5)

**Objectif** : Un employe peut scanner les cartes clients et ajouter des tampons.

### 4.1 Invitation employe
- Dans /settings : bouton "Inviter un employe"
- Formulaire : email de l'employe
- Email envoye avec lien d'invitation (/invitation/[token])
- L'employe cree son compte avec role "employee"

### 4.2 App scanner
- Route /scanner
- Layout mobile-first minimaliste (header avec logo + nom du business)
- Composant camera :
  - Acceder a la camera du telephone
  - Detecter les QR codes / barcodes en temps reel
  - Librairie : html5-qrcode ou @zxing/browser
- Au scan reussi :
  - Appel API POST /api/scan avec le token de la card_instance
  - Affichage du resultat :
    - Nom du client
    - Tampons : X / Y (avec animation d'ajout du tampon)
    - Si recompense atteinte : alerte celebrante "Recompense debloquee !"
    - Bouton "Utiliser la recompense" (si rewards_available > 0)
    - Bouton "Scanner suivant" (reset pour le prochain client)

### 4.3 API scan
- POST /api/scan
  - Input: token de la card_instance
  - Auth: verifie que le scanner est un employee du meme business
  - Action: appelle la fonction SQL add_stamp()
  - Output: stamps_collected, rewards_available, reward_earned, reward_text

### 4.4 API redeem
- POST /api/redeem
  - Input: card_instance_id
  - Auth: employee du meme business
  - Action: appelle la fonction SQL redeem_reward()
  - Output: success, rewards_remaining

**Livrable** : Un employe ouvre /scanner sur son tel, scanne le QR du client, le tampon s'ajoute.

---

## PHASE 5 : Dashboard et stats (Semaine 6)

**Objectif** : Le commercant voit ses performances et gere ses clients.

### 5.1 Dashboard KPIs
- Nombre total de clients
- Scans aujourd'hui
- Scans ce mois
- Taux de retour (clients qui reviennent > 1 fois)
- Filtres temporels : Aujourd'hui | 7 jours | 30 jours

### 5.2 Base clients
- Route /clients
- Tableau avec colonnes : Nom | Telephone | Carte | Tampons | Derniere visite
- Tri par colonne
- Recherche par nom/telephone
- Detail client : historique des scans

### 5.3 Stats par carte
- Route /cards/[id]/stats
- Installations totales
- Scans totaux
- Recompenses distribuees
- Graphique simple (barres) : scans par jour sur les 30 derniers jours

### 5.4 Settings
- Route /settings
- Modifier le profil (nom, prenom, telephone)
- Modifier le business (nom, logo, adresse, categorie)
- Liste des employes invites + statut

**Livrable** : Dashboard complet avec KPIs, base clients et stats par carte.

---

## PHASE 6 : Polish et deploiement (Semaines 7-8)

**Objectif** : Produit pret pour les premiers beta-testeurs.

### 6.1 UX polish
- Loading states (skeletons)
- Toasts de confirmation/erreur
- Animations subtiles (tampon ajoute, recompense)
- Empty states avec illustrations
- Responsive mobile parfait sur toutes les pages

### 6.2 Edge cases
- Carte expiree : gestion propre
- Double scan protection (pas 2 tampons en 1 minute)
- Client deja inscrit sur la meme carte : message clair
- Token invalide : page 404 elegante
- Upload echoue : retry + message d'erreur

### 6.3 SEO et meta
- Page d'installation client : meta tags Open Graph (preview dans WhatsApp quand on partage le lien)
- Favicon, titre de page dynamique

### 6.4 Tests manuels
- Parcours complet : inscription → carte → QR → scan → recompense
- Test sur iPhone Safari + Android Chrome
- Test scanner dans des conditions reelles (luminosite, angle)

### 6.5 Deploiement production
- Domaine custom (fidpass.fr ou similaire)
- Variables d'env production Supabase
- Vercel production deploy
- Monitoring basique (Vercel Analytics)

**Livrable** : Produit en production, pret a montrer aux premiers commercants.

---

## RESUME VISUEL

```
Semaine 1  ████████ PHASE 1 : Fondations (auth, layout, sidebar)
Semaine 2  ████████ PHASE 2 : Creation carte tampon (debut)
Semaine 3  ████████ PHASE 2 : Creation carte tampon (fin) + preview live
Semaine 4  ████████ PHASE 3 : Page client + installation carte
Semaine 5  ████████ PHASE 4 : Scanner employe
Semaine 6  ████████ PHASE 5 : Dashboard, stats, clients
Semaine 7  ████████ PHASE 6 : Polish, edge cases
Semaine 8  ████████ PHASE 6 : Tests, deploy production
```

---

## POST-MVP (V2, V3...)

Ordre de priorite suggeree pour les features suivantes :

**V2 (mois 3-4) :**
- Push notifications via wallet passes (Apple Wallet .pkpass avec certificat)
- Google Wallet integration reelle
- Stripe pour le paiement des abonnements
- 2-3 types de cartes supplementaires (Remise, Cashback)

**V3 (mois 5-6) :**
- Multi-locations + Geo-Push
- Gestion des managers (roles, permissions)
- Segmentation RFM basique
- Emails transactionnels (Resend)

**V4 (mois 7+) :**
- Flow builder d'automatisations
- Integrations (WhatsApp, Telegram)
- Mode agence / marque blanche
- API publique pour les integrateurs
