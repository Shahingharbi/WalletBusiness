# Analyse UX Complete - BoomerangMe Dashboard
# SPECIFICATION FONCTIONNELLE POUR REPRODUCTION A 100%

> Source: dashboard marchand BoomerangMe (app.boomerangme.cards)
> Date d'exploration: 15-16 Avril 2026
> Compte utilise: Shahin (essai Grow, expire 29.04.2026)
> Domaines: my.boomerangme.cards (redirect) -> app.boomerangme.cards (app)

---

## ARCHITECTURE GLOBALE DE L'APPLICATION

### Structure de l'app
- **Type**: SPA (Single Page Application)
- **Framework probable**: React (base sur la structure du DOM)
- **Routing**: Client-side routing (`/cards`, `/clients`, etc.)
- **Auth**: Session-based, redirection vers login si non connecte
- **Langue**: Multi-langue avec toggle (FR par defaut, EN disponible)
- **Responsive**: Desktop-first, sidebar collapsible

### Layout principal (toutes les pages)
```
+------------------------------------------------------------------+
| TOP BAR (sticky, fond noir, h~70px)                              |
| Logo | Bonjour, [Nom] v | Carte: [nom] v | icons | Lang | Badge |
+------+-----------------------------------------------------------+
| SIDE | SUB-NAV (onglets horizontaux, fond gris)                   |
| BAR  +-----------------------------------------------------------+
| 70px | CONTENU PRINCIPAL                                          |
| wide |                                                            |
|      |                                                            |
| icon |                                                            |
| icon |                                                            |
| icon |                                                            |
| icon |                                                            |
| icon |                                                            |
| icon |                                                            |
+------+-----------------------------------------------------------+
```

### Top Bar - Detail complet
- **Position**: fixed top, z-index eleve
- **Fond**: noir (#1a1a1a ou similaire)
- **Hauteur**: environ 70px
- **Elements de gauche a droite**:
  1. **Logo "Boomerang"**: texte blanc, font bold/black, serif-like (custom font)
  2. **Selecteur compte**: "Bonjour, Shahin" + chevron dropdown - permet de switcher entre comptes/business
  3. **Selecteur carte** (contextuel): "Carte actuelle: Shahin / Stamp" + chevron - visible uniquement dans les pages carte
  4. **Icone ampoule**: lien vers https://bmrng.canny.io (board de suggestions/feature requests)
  5. **Icone cloche**: notifications in-app, avec badge rouge si non lues
  6. **Icone play**: tutoriels video
  7. **Icone (i)**: informations/documentation, lien vers https://docs.boomerangme.cards
  8. **Badge langue**: "Fr" dans un cercle - toggle FR/EN
  9. **Badge partenaire**: icone ronde rouge/blanc "Chambers" - programme partenaire

### Sidebar Navigation - Detail complet
- **Position**: fixed left, z-index eleve
- **Largeur**: environ 70px (icones only, pas de labels)
- **Fond**: gradient rose-peche tres leger ou transparent
- **Icone active**: fond gris/noir arrondi
- **Hover**: fond gris clair

| # | Icone | Page | URL | Description |
|---|-------|------|-----|-------------|
| 1 | Fusee avec engrenage | Onboarding | `/onboarding` | Guide de demarrage |
| 2 | Maison | Dashboard | `/` | Tableau de bord principal |
| 3 | Document/carte | Cards | `/cards` | Gestion des cartes de fidelite |
| 4 | 2 personnes | Clients | `/clients` | CRM / Base clients |
| 5 | Bulle de dialogue | Mailings | `/mailings/inbox` | Messagerie et push |
| 6 | Noeuds connectes | Automations | `/automations` | Workflows automatises |
| 7 | Pin geoloc | Locations | `/locations` | Points de vente |
| 8 | Personne avec badge | Managers | `/managers` | Gestion employes |
| 9 | Engrenage | Settings | `/settings` | Parametres du compte |
| 10 | Dollar $ | Billing | `/first-promoter` | Pricing et facturation |

### Bannieres d'alerte (empilees en haut du dashboard)
Trois bannieres empilees, supprimables:
1. **Rouge vif** (paiement): "Pour utiliser toutes les fonctionnalites du service, associez un mode de paiement" + bouton noir "Ajouter"
2. **Rouge vif** (trial): icone warning jaune + "Votre essai Grow expire sur 29.04.2026. Mettez a niveau votre compte maintenant" (lien souligne) + icone telephone + "Planifier une demo"
3. **Vert vif** (onboarding): emoji technicien + "Installation gratuite dans les 14 jours" + lien souligne "Demande de mise en oeuvre"

### Elements globaux persistants
- **Bouton "Create card"**: noir, en bas a gauche, toujours visible (sauf sur certaines pages)
- **Intercom Messenger**: bulle noire en bas a droite, widget de chat support
- **Cloche de notifications**: badge rouge avec compteur, en bas a droite aussi (separee d'Intercom)

---

## 1. DASHBOARD (`/`)

### URL: `https://app.boomerangme.cards/`
### Sous-navigation: Aucune (page principale)

### Layout
Split en 2 vues switchables: "Nouveau" et "Vieux"

### Vue "Nouveau" (par defaut)
**Filtres temporels** (boutons pill horizontaux):
- Aujourd'hui (selectionne par defaut, fond gris)
- Les 7 derniers jours
- Les 4 dernieres semaines
- Les 6 derniers mois
- Les 12 derniers mois
- Le mois courant
- Periode (ouvre un date picker)

**Titre dynamique**: "Aujourd'hui - 15 Avril 2026" (change selon le filtre)

**Onglets de donnees**: Revenu | Visites (boutons pill)

**Zone de contenu**: vide si pas de donnees

### Vue "Vieux"
**Filtres temporels** (plus simples):
- Jour | Semaine | Mois (selectionne) | An | Periode

**Titre dynamique**: "Le mois dernier, 16 Mars - 15 Avril 2026"

**KPIs affiches** (3 colonnes):
| Colonne 1 | Colonne 2 | Colonne 3 |
|-----------|-----------|-----------|
| Visites totales: -- | Clients reguliers (avec dropdown fleche): -- | Derniere periode |

### Flow utilisateur
1. L'utilisateur arrive sur le dashboard apres login
2. Il peut basculer entre vue Nouveau/Vieux
3. Il choisit une periode temporelle
4. Il voit ses KPIs (Revenu ou Visites)
5. Les graphiques se mettent a jour en fonction

---

## 2. CARDS - LISTE (`/cards`)

### URL: `https://app.boomerangme.cards/cards`
### Sous-navigation: Modeles | Promotions (2 onglets)

### Onglet "Modeles" (par defaut)
**Layout**: Grille horizontale de cartes dans des mockups iPhone
- Chaque carte est affichee dans un **mockup iPhone** realiste (bordure noire, encoche)
- Scroll horizontal si beaucoup de cartes

**Pour chaque carte**:
- **Badge de status** en haut: point colore + nom du type
  - Point vert "Actif" = carte active
  - Point rouge "Tampon" / "Remise" = carte inactive ou type
- **Mockup iPhone** contenant:
  - Icone du commerce (coin superieur gauche)
  - Image/banniere principale
  - Contenu specifique au type (tampons, pourcentage, etc.)
  - Barcode en bas (PDF417 ou QR Code)
- **Icone de drag** (fleches directionnelles) au centre au hover - pour reordonner

### Cartes observees
1. **Carte vide** (Actif): icone etoile/sparkle au centre, pas de contenu, en cours de creation
2. **Carte Tampon** (Tampon): 
   - Icone commerce en haut a gauche
   - Image de ville europeenne (architecture)
   - 5 tampons ronds avec check marks (4 actifs gris fonce, 1 inactif gris clair)
   - Labels: "STAMPS UNTIL THE REWA..." = "3 tampons" | "AVAILABLE REWARDS" = "2 recompen..."
   - Barcode PDF417 en bas
3. **Carte Remise** (Remise):
   - Icone commerce en haut a gauche
   - Image de fontaine/place italienne
   - Labels: "DISCOUNTS PERCENTAGE" = "5%" | "DISCOUNT STATUS" = "5%"
   - Barcode PDF417 en bas

### Onglet "Promotions"
> Non explore en detail - contient les promotions attachees aux cartes

---

## 3. CARDS - DETAIL D'UNE CARTE (`/cards/[id]`)

### URL: `https://app.boomerangme.cards/cards/1077773`
### Sous-navigation: Information | Clients | Envoyer Push Notification | Statistiques | Commentaires | ? | Editer

### Page "Information" (defaut)
**Layout**: 2 colonnes
- **Colonne gauche (60%)**: 
  - Titre: "[Nom du business] / [Type]" ex: "Shahin / Stamp"
  - Badge type en haut a droite: point rouge + "Tampon"
  - Mockup iPhone grande taille avec la carte complete
- **Colonne droite (40%)**:
  - **QR Code** tres grand (pour impression/partage)
  - Le QR code contient le lien d'installation de la carte

### Boutons
- "Create card" en bas a gauche (persistant)

### Flow utilisateur
1. Le marchand clique sur une carte dans la liste
2. Il voit sa carte en preview + le QR code a partager
3. Il peut naviguer vers Clients, Push, Stats, etc. via les onglets
4. Il peut editer la carte via l'onglet "Editer"

---

## 4. CARDS - EDITEUR COMPLET (`/cards/[id]/edit`)

### URL de base: `https://app.boomerangme.cards/cards/1077773/edit`

### Navigation wizard (etapes lineaires)
```
[Nom carte*] → [Type de ca...] — [Parametres] — [Design] — [Information] → [?] → [Enregistrer et visualiser] [QR]
```
- Le nom de la carte est editable directement dans l'onglet (champ texte avec *)
- Les etapes sont connectees par des tirets
- L'icone QR en fin de barre ouvre le QR code

### Layout de toutes les pages editeur
```
+---------------------------+---------------------------+
| FORMULAIRE (60%)          | PREVIEW LIVE (40%)        |
| Champs, options,          | Mockup iPhone             |
| toggles, uploads          | + badge Actif/Inactif     |
|                           | + boutons Apple/Android   |
|                           |                           |
+---------------------------+---------------------------+
```

La preview a droite contient:
- Badge "Inactif" (point rouge) ou "Actif" (point vert) en haut
- Mockup iPhone avec la carte qui se met a jour en temps reel
- Bouton Apple (icone pomme noire) - preview Apple Wallet
- Bouton Android (icone robot) - preview Google Wallet
- Barcode en bas

---

### 4a. ETAPE "TYPE DE CARTE" (`/edit`)

**Titre**: "Type de carte" + icone (i) info

**Grille de selection** (3 colonnes x 2 lignes):

| Position | Icone | Nom | Badge |
|----------|-------|-----|-------|
| 1,1 | Tampon (sceau) | **Tampon** | Badge vert "Retention elevee" |
| 1,2 | Cadeau | **Recompense** | Badge outline "Retention elevee" |
| 1,3 | Groupe personnes | **Adhesion** | Badge outline "Retention elevee" |
| 2,1 | Pourcentage | **Remise** | Badge outline "Retention elevee" |
| 2,2 | Dollar cercle | **Cashback** | Badge outline "Retention elevee" |
| 2,3 | Etiquette prix | **Coupon** | Badge outline "Meilleur pour l'acquisition" |

- La carte selectionnee a un **fond noir** avec texte/icone blanc
- Les autres ont un fond blanc avec bordure grise
- Les badges "Retention elevee" sont verts (rempli pour la selection, outline pour les autres)

### Comportement par type de carte

**Tampon (Stamp Card)**:
- Le client collecte des tampons a chaque visite/achat
- Apres X tampons, il recoit une recompense
- Affiche: nombre de tampons, tampons restants, recompenses disponibles

**Recompense (Reward)**:
- Programme de recompenses base sur des points ou des niveaux
- Affiche: points accumules, recompenses debloquees

**Adhesion (Membership)**:
- Carte de membre avec statut
- Affiche: niveau d'adhesion, avantages

**Remise (Discount)**:
- Pourcentage de reduction permanent
- Affiche: pourcentage actuel, statut de la remise

**Cashback**:
- Retour d'argent sur les achats
- Affiche: montant cashback accumule

**Coupon**:
- Coupon a usage unique ou limite
- Affiche: reduction, validite

---

### 4b. ETAPE "PARAMETRES" (`/edit/settings`)

**Titre**: "Parametres" + icone (i)

**Section 1: Type de code-barres**
- Radio: **PDF 417** (selectionne par defaut, cercle vert)
- Radio: **QR Code**
- Le barcode change en temps reel dans la preview

**Section 2: Programme de recompense** (specifique carte Tampon)
- Radio: **Tampons** (selectionne, cercle vert) - "Donnez des tampons en fonction de vos regles"
- Radio: **Depenser** - "Donnez des tampons en fonction des depenses du client"
- Radio: **Produits** - "Attribuer des tampons en fonction des produits presents sur le ticket de caisse"

**Section 3: Promotions**
- Bouton pleine largeur: **"Creer une promotion"** (fond noir, texte blanc)
- Permet d'associer des promotions speciales a la carte

**Section 4: Date d'expiration de la carte** + icone (i)
- Radio: **Illimite** (selectionne, cercle vert) - la carte n'expire jamais
- Radio: **Duree determinee** - date fixe d'expiration
- Radio: **Duree fixe apres l'enregistrement de la carte** - ex: 30 jours apres que le client installe la carte

**Section 5: Duree de vie des tampons** + icone (i)
- Radio: **Illimite** (selectionne, cercle vert)
- (Probablement d'autres options quand on selectionne une duree)

**Section 6: Bouton d'installation de Google Wallet**
- Toggle: ON (vert) par defaut
- Label: "Afficher le bouton Google Wallet dans le formulaire d'installation de la carte"

**Section 7: Bouton d'installation PWA**
- Toggle: ON (vert) par defaut
- Label: "Afficher le bouton PWA dans le formulaire d'installation de la carte"

**Section 8: Limitez le nombre de cartes emises**
- (Options de limitation - non explore en detail)

---

### 4c. ETAPE "DESIGN" (`/edit/design`)

**Titre**: "Design" + icone (i)

**Section 1: Nombre de tampons** + icone (i)
- Grille de boutons ronds numerotes de **1 a 30** (3 lignes de 9 + 1 ligne de 3)
- Layout: 9 boutons par ligne (1-9, 10-18, 19-27, 28-30)
- Boutons selectionnes (1 a 5 dans notre cas): fond noir, texte blanc
- Boutons non selectionnes: fond blanc, texte gris, bordure grise
- Cliquer sur un numero = definir le nombre total de tampons

**Section 2: Images**
Deux zones d'upload cote a cote:

| Zone | Label | Specs |
|------|-------|-------|
| Image/Banniere | (zone de drop gauche) | Taille recommandee: 480x150 pixels |
| Icone | (zone de drop droite) | Taille recommandee de l'icone: 512x512 |

**Section 3: Tampon actif** + icone (i)
- **Dropdown**: selection d'icone predefinie (ex: "Verifier" = check mark)
  - Autres options probables: etoile, coeur, pouce, etc.
- **Zone d'upload**: drag & drop ou "Choisir le fichier"
  - Specs: 200x200 pixels minimum, format PNG uniquement, 3 megaoctets max
- L'icone apparait sur les tampons deja collectes par le client

**Section 4: Tampon inactif** + icone (i)
- Meme structure que tampon actif
- **Dropdown**: selection d'icone predefinie (ex: "Verifier")
- **Zone d'upload**: memes specs (200x200px, PNG, 3MB)
- L'icone apparait sur les tampons pas encore collectes (grise)

**Section 5: Logo** + icone (i)
- Zone d'upload avec preview
- Bouton "file..." pour choisir le fichier
- Bouton poubelle pour supprimer
- Le logo apparait en haut a gauche de la carte wallet

**Section 6: Icon** + icone (i)
- Zone d'upload avec preview
- Bouton "file..." pour choisir le fichier
- Bouton poubelle pour supprimer
- L'icone apparait dans les notifications push et sur l'ecran d'accueil (PWA)

**Section 7: Labels personnalisables**
Systeme de paires dropdown + champ texte:

| Dropdown (type de champ) | Champ texte (valeur affichee) |
|--------------------------|-------------------------------|
| "Tampons jusqu'a la recom..." | "Stamps until the reward" |
| "Recompenses disponibles" | "Available rewards" |

- Le dropdown permet de choisir quel champ afficher sur la carte
- Le champ texte permet de personnaliser le label dans la langue souhaitee

**Section 8: Options d'affichage**
- Toggle: **"Afficher le logo dans le formulaire d'emission de la carte"** + icone (i) → defaut ON
- Toggle: **"Utiliser la couleur de fond dans le formulaire d'emission de la carte"** + icone (i) → defaut ON

**Section 9: Boutons d'action**
- Bouton noir pleine largeur: **"Continuer"** → passe a l'etape Information
- Bouton noir a droite (dans preview): **"Activer"** → active la carte pour distribution
- Note sous le bouton Activer: "Tant que la carte n'est pas activee, vous pouvez emettre jusqu'a 10 cartes pour les clients"

**Branding**: Texte "Powered by Boomerangme" en bas de la preview (probablement removable dans les plans payants)

---

### 4d. ETAPE "INFORMATION" (`/edit/information`)
> Non explore en detail - probablement les infos textuelles de la carte (description, conditions, adresse, etc.)

### 4e. "ENREGISTRER ET VISUALISER"
> Bouton final pour sauvegarder et voir le resultat

---

## 5. CARDS - STATISTIQUES (`/cards/[id]/statistics`)

### URL: `https://app.boomerangme.cards/cards/1077773/statistics`

### Elements cles
- **Titre**: "Statistiques des cartes"
- **Sous-titre**: "Activite des clients"

### Filtres temporels
Boutons pill: Jour | Semaine | **Mois** (selectionne) | An | Periode

### Graphiques
**2 graphiques line chart cote a cote**:
- Axe X: dates (ex: Mar 16 → Apr 15)
- Axe Y: compteurs (0, 1, 2, 3)
- Ligne bleue pointillee (donnees)
- Probablement: Nouvelles installations | Visites (ou Installations | Desinstallations)

### Section "Retour"
- En dessous des graphiques
- Icone (i) info
- Probablement le taux de retour des clients

---

## 6. CARDS - PUSH NOTIFICATION (`/cards/[id]/push`)

### URL: `https://app.boomerangme.cards/cards/1077773/push`

### Header
- **Titre**: "Envoyer Push Notification"
- **Badge bleu**: "Gratuit!" - indique que les push sont inclus gratuitement
- **Description**: "Ces messages seront affiches sur les ecrans de verrouillage des telephones clients et egalement sous les dernieres mises a jour a l'arriere de leurs cartes."

### Formulaire d'envoi

**Section "Envoyer un Push"**:

**Ciblage** (2 boutons mutuellement exclusifs):
- Bouton noir: **"Pour tous les clients"** (selectionne par defaut)
- Bouton outline: **"Segment selectionne"** → ouvre probablement un selecteur de segment

**Compteur**: icone 2 personnes + "0 clients recevront votre message"

**Options**:
- Checkbox: **"Programme"** → active la planification (date/heure d'envoi)

**Composition du message**:
- Champ: **"Message"** (textarea/input)
  - Placeholder: "Message"
  - Bouton emoji (icone smiley avec etoile) a droite du champ
  - Champ requis (asterisque *)

### Preview (colonne droite)
- Mockup iPhone ecran de verrouillage
- Fond gris fonce
- Notification push avec:
  - Icone du commerce (petit carre)
  - Nom en majuscules: "SHAHIN"
  - Heure: "maintenant"
  - Texte du message avec emojis: "Apercu du Push notification avec des emojies 🌙 📧 💬 🤩."

---

## 7. CLIENTS (`/clients`)

### URL: `https://app.boomerangme.cards/clients`
### Sous-navigation: Clients | Commentaires

### Header
- **Titre**: "Base clients"

### Actions (3 boutons)
| Bouton | Style | Action |
|--------|-------|--------|
| Exporter | Outline noir | Exporter la base clients (CSV/Excel probable) |
| Importer | Outline noir | Importer des clients depuis un fichier |
| Ajouter des clients | Noir plein | Ajouter manuellement un client |

### KPI Cards (grille 2x2)
```
+---------------------------+---------------------------+
| 0                         | 0                         |
| Clients totaux            | Cartes installees         |
+---------------------------+---------------------------+
| 0                         | ☆☆☆☆☆                    |
| Transactions par cartes   | Evaluation des reactions  |
+---------------------------+---------------------------+
```
- Chaque KPI dans une card blanche avec bordure
- Gros chiffre + label en dessous
- L'evaluation utilise 5 etoiles (vides = pas de notes)

### Barre de segmentation (en bas, sticky)
Barre horizontale avec onglets:

| Icone | Label | Description |
|-------|-------|-------------|
| Filtre | Mes filtres | Filtres personnalises sauvegardes |
| Dossier | Mes segments | Segments personnalises |
| Coeur | En bonne sante | Clients actifs et engages |
| Emoji sourire | Loyaute | Clients fideles (visites repetees) |
| Etoile/puzzle | Segments RFM | Segmentation Recency-Frequency-Monetary |
| Avion papier | Communication | Preferences de communication |
| + | (ajouter) | Creer un nouveau segment/filtre |
| Engrenage | (parametres) | Configurer les segments |

### Liste de clients (sous les KPIs)
- Tableau/liste des clients (vide dans notre cas)
- Probablement colonnes: Nom, Email, Telephone, Carte, Tampons, Derniere visite, etc.

### Onglet "Commentaires"
- Feedback et avis laisses par les clients
- Probablement lie au systeme d'evaluation 5 etoiles

---

## 8. MAILINGS / INBOX (`/mailings/*`)

### URL de base: `https://app.boomerangme.cards/mailings/inbox`

### Sous-navigation (5 onglets)
| # | Onglet | URL | Description |
|---|--------|-----|-------------|
| 1 | Boite de reception | `/mailings/inbox` | Conversations avec les clients |
| 2 | Courrier electronique | `/mailings/email` | Envoi d'emails marketing |
| 3 | Envoyer Push Notification | `/mailings/push` | Push global (pas lie a une carte specifique) |
| 4 | Automatisation Push | `/mailings/auto-push` | Push automatises |
| 5 | Auto-Push personnalise | `/mailings/custom-auto-push` | Push auto custom |

---

### 8a. BOITE DE RECEPTION (`/mailings/inbox`)

**Layout 3 colonnes**:

**Colonne 1 - Filtres (etroite, ~150px)**:
- Titre tronque: "Bo..." (Boite) + icone loupe (recherche)
- Liste de boites avec compteurs:

| Icone | Label (tronque) | Compteur |
|-------|-----------------|----------|
| Globe rouge | V... (Vues/Tous) | 0 |
| Etoile | F... (Favoris) | 0 |
| Boite upload | E... (Envoyes) | 0 |
| Boite download | R... (Recus) | 0 |
| Dossier | O... (Ouverts) | 0 |
| Dossier | N... (Nouveaux) | 0 |
| Fleche partage | R... (Repondus) | 0 |

**Colonne 2 - Liste conversations (~350px)**:
- Titre: "Vos conver..." (Vos conversations)
- Etat vide: icone bulle + "Pas de conversations"

**Colonne 3 - Detail conversation (~500px)**:
- Etat vide: icone bulle + "Selectionner la conversation"
- Panel lateral: "Pas de details"

---

### 8b. AUTOMATISATION PUSH (`/mailings/auto-push`)

**Header**:
- Titre: "Automatisation Push"
- Badge bleu: **"Gratuit!"**
- Badge vert: **"Actif"**
- Description: "Configurez des notifications PUSH automatiques selon votre propre script. Felicitez le client pour son anniversaire, recueillez ses commentaires, rappelez-lui de revenir vous voir."

**Formulaire**:
- Dropdown: **"Carte"** - selectionner la carte a laquelle associer l'automatisation
  - Placeholder: "Carte" avec chevron

**Preview (colonne droite)**:
- Mockup iPhone avec notification push
- "NOM DE L'ENTREPRISE" en majuscules (placeholder)
- "maintenant"
- Message d'apercu avec emojis

---

## 9. AUTOMATIONS (`/automations`)

### URL: `https://app.boomerangme.cards/automations`
### Sous-navigation: Aucune

### Header
- **Titre**: "Automatisation"
- **Bouton**: "Creer une automatisation" (noir, en haut a droite)

### Barre de recherche
- Placeholder: "Chercher"
- Icone loupe a droite

### Liste des automatisations
Chaque automatisation est une **card blanche** avec:
```
+------------------------------------------------------+
| Card Delivery                               [poubelle]|
|                                                        |
| (horloge) 15.04.2026 13:41                            |
| (eclair)  0                                           |
| (point rouge) Configuration requise                    |
|                                                        |
| [========= Editer =========]                          |
| [--------- Activer ---------]                          |
| [--------- Copier ----------]                          |
+------------------------------------------------------+
```

**Champs affiches par automation**:
- **Nom**: texte libre (ex: "Card Delivery")
- **Date de creation**: icone horloge + date/heure
- **Compteur d'executions**: icone eclair + nombre
- **Status**: point colore + texte
  - Point rouge + "Configuration requise" = incomplet
  - Point vert + "Actif" = en cours d'execution
- **Actions**:
  - Bouton noir "Editer"
  - Bouton outline "Activer"
  - Bouton outline "Copier"
  - Icone poubelle (supprimer) en haut a droite

---

### 9a. EDITEUR D'AUTOMATISATION (`/automations/[uuid]`)

### URL: `https://app.boomerangme.cards/automations/019d90f2-ac5f-718b-aad5-634eb77f37f0`

**Type d'interface**: Flow builder visuel (similaire a Zapier, n8n, Make)

### Header de l'editeur
- **Bouton rouge**: "Configurer l'automatisation" (ouvre probablement un panel lateral)
- **Bouton play**: lancer/tester l'automatisation
- **Bouton outline**: "Retour" (revenir a la liste)

### Canvas
- **Zoomable**: boutons + / - avec affichage du pourcentage (ex: "100%")
- **Fond**: blanc/gris clair
- **Noeuds** connectes par des **fleches pointillees verticales**

### Champ nom
- En haut du canvas: champ texte editable avec le nom de l'automatisation (ex: "Card Delivery")

### Types de blocs observes

**Bloc 1: DECLENCHEUR** (Trigger)
```
+--------------------------------------------------+
|  (icone curseur)                                   |
|                                          [3 points]|
|              Declencheur                           |
|                                                    |
|           Carte enregistree                        |
|                                                    |
| +----------------------------------------------+  |
| | (orange) Veuillez remplir les champs         |  |
| |          obligatoires: templateId            |  |
| +----------------------------------------------+  |
+--------------------------------------------------+
```
- Icone: curseur/pointeur dans un cercle
- Titre: "Declencheur"
- Valeur: type d'evenement (ex: "Carte enregistree")
- Erreur orange si champs manquants
- Menu 3 points pour options (modifier, supprimer, etc.)
- Types de declencheurs probables: Carte enregistree, Carte installee, Tampon ajoute, Recompense atteinte, etc.

**Bloc 2: ATTENDRE** (Delay)
```
+--------------------------------------------------+
|  (icone horloge)                                   |
|                                    [toggle ON] [3p]|
|              Attendre                              |
|                                                    |
|  +----------------------------------------------+ |
|  | 5 Minutes                                     | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
```
- Icone: horloge dans un cercle
- Titre: "Attendre"
- Toggle ON/OFF (vert quand actif) pour activer/desactiver le bloc
- Champ: duree (ex: "5 Minutes")
- Menu 3 points
- Options de duree probables: Minutes, Heures, Jours

**Bloc 3: REGLE** (Condition)
```
+--------------------------------------------------+
|  (icone noeuds)                                    |
|                                    [toggle ON] [3p]|
|              Regle                                 |
|                                                    |
|  +----------------------------------------------+ |
|  | Statut de carte  [Egal Pas installe]          | |
|  +----------------------------------------------+ |
+--------------------------------------------------+
         |                    |
    [VRAI]              [FAUX]
         |                    |
```
- Icone: noeuds connectes dans un cercle
- Titre: "Regle"
- Toggle ON/OFF
- Condition: champ + operateur + valeur
  - Champ: "Statut de carte"
  - Operateur: "Egal" (badge noir arrondi)
  - Valeur: "Pas installe"
- **Branchement**: 2 sorties (vrai/faux) - le flow se divise
- Menu 3 points

### Flow type "Card Delivery" (observe)
```
[Carte enregistree] → (5 min) → [Si carte pas installee] → [Action: envoyer push de rappel?]
```

### Blocs probables non observes
- **Action Push**: envoyer une notification push
- **Action Email**: envoyer un email
- **Action SMS**: envoyer un SMS
- **Action Tampon**: ajouter/retirer un tampon
- **Action Segment**: ajouter/retirer d'un segment

---

## 10. LOCATIONS (`/locations`)

### URL: `https://app.boomerangme.cards/locations`
### Sous-navigation: Aucune

### Header
- **Titre**: "Localisations"
- **Badge bleu**: "Geo-Push dans une zone de 100 metres"
- **Badge vert** a droite: "Actif"

### Description
"Avec votre plan **vous disposez de 3 localisations**. Dans un rayon de 100 metres de votre emplacement, les utilisateurs peuvent voir votre message Geo-Push sur l'ecran de leur mobile."

### Elements
- **Bouton**: "Ajouter un emplacement" (noir, pleine largeur)
- **Liste des emplacements existants**:
  - Card blanche: "Chambery" + toggle ON/OFF (vert = actif)
  - Chaque emplacement peut etre active/desactive individuellement

### Preview (colonne droite)
- Mockup iPhone avec notification push geo-localisee
- "NOM DE L'ENTREPRISE" + "maintenant"
- Message d'apercu avec emojis

### Fonctionnalite Geo-Push
- Quand un client avec la carte installee passe a moins de 100m d'un point de vente, il recoit automatiquement un push
- Le nombre de geolocations depend du plan:
  - Partner: 1
  - Grow: 3
  - Business: 10
  - Agency: 10
  - Franchise: 10

---

## 11. MANAGERS (`/managers`)

### URL: `https://app.boomerangme.cards/managers`
### Sous-navigation: Aucune

### Header
- **Titre**: "Managers"
- **Lien**: "Application de scanner" (icone document + texte) - ouvre l'app scanner webapp
- **Bouton outline**: "Telecharger le rapport" - export des donnees managers
- **Bouton noir**: "Ajouter un manager" - inviter un employe

### Barre de recherche
- Placeholder: "Chercher"
- Icone loupe a droite

### Liste des managers
- Tableau/liste (vide dans notre cas)
- Probablement colonnes: Nom, Email, Role, Location, Derniere activite, Actions

### Application Scanner
- Webapp separee accessible via le lien "Application de scanner"
- Permet aux employes de:
  - Scanner les barcodes/QR des cartes clients
  - Ajouter des tampons
  - Valider des recompenses
  - Voir l'historique du client

### Limites par plan
- Partner: non inclus
- Grow: 10 sieges managers
- Business: 50 sieges
- Agency: 50 sieges
- Franchise: 50 sieges

---

## 12. SETTINGS (`/settings`)

### URL: `https://app.boomerangme.cards/settings`
### Sous-navigation (5 onglets):
1. **Forfait** (`/settings`) - Plan actuel et comparaison
2. **Parametres personnels** (`/settings/personal`) - Profil utilisateur
3. **Connecter comptes** (`/settings/services`) - Integrations tierces
4. **RFM** (`/settings/rfm-segments`) - Configuration segmentation RFM
5. **Notifications** (`/settings/notifications`) - Alertes marchand

---

### 12a. FORFAIT (`/settings`)

**Section plan actuel**:
- Sous-onglets: Forfait | Historique des paiements
- Bannieres d'alerte (rouge) pour mode de paiement et expiration trial
- Tableau plan actuel:
  - **Formule**: Grow (Essai)
  - **Prix**: 139 $US par mois (paiement annuel)
  - **Date de paiement**: 29.04.2026
  - **Jours restants**: 13
- Boutons: "Besoin de plus?" | "Saisir le code promotionnel"
- Bouton: "Prolonger"

**Tableau comparatif des plans**:

| Fonctionnalite | PARTNER | GROW | BUSINESS | AGENCY | FRANCHISE |
|----------------|---------|------|----------|--------|-----------|
| **Prix/mois (annuel/trimestriel/mensuel)** | $97/$97/$97 | $114/$126/$139 | $164/$179/$199 | $214/$239/$259 | $249/$269/$299 |
| Promotions disponibles | 1 | 3 | 10 | 10 | 10 |
| Cartes de tampon | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Cartes multipass | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Cartes Cashback | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Cartes de reduction | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Carte cadeau | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Cartes de coupons | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Cartes d'adhesion | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Cartes de recompense | 100 cartes | Illimite | Illimite | Illimite | Illimite |
| Modeles de cartes | 111 modeles prets a l'emploi | Oui | Oui | Oui | Oui |
| Conception personnalisee | Oui | Oui | Oui | Oui | Oui |
| CRM | Oui | Oui | Oui | Oui | Oui |
| PUSH gratuit | Illimite | Illimite | Illimite | Illimite | Illimite |
| Geo Push | 1 geoloc | 3 geolocs | 10 geolocs | 10 geolocs | 10 geolocs |
| Concepteur automatique | Illimite | Illimite | Illimite | Illimite | Illimite |
| PWA Scanner App | Oui | Oui | Oui | Oui | Oui |
| Programme de parrainage | Oui | Oui | Oui | Oui | Oui |
| Controle des doublons | Oui | Oui | Oui | Oui | Oui |
| Analytique | Oui | Oui | Oui | Oui | Oui |
| Sieges managers | - | 10 | 50 | 50 | 50 |
| API | - | - | Oui | Oui | Oui |
| Champs personnalises | - | - | Oui | Oui | Oui |
| Marque Blanche | - | - | - | Oui | Oui |
| Nom de domaine personnalise | - | - | - | Oui | Oui |
| Option de revendeur | - | - | - | - | Oui |
| Sous-comptes | - | - | - | - | Oui |
| Stripe Connect | - | - | - | - | Oui |
| PayPal | - | - | - | - | Oui |

**Periodes de paiement**: An (annuel) avec bouton "Acheter" + "Avez-vous un Code Promo?"

---

### 12b. PARAMETRES PERSONNELS (`/settings/personal`)

**Section profil (colonne gauche)**:
- **Avatar/Photo**: Image ronde uploadable (avec "Supprimer l'image")
- **Nom affiche**: "Shahin Gharbi"
- **Email affiche**: gharbishahin73@gmail.com

**Formulaire (colonne droite - grille 2 colonnes)**:

| Champ | Type | Valeur exemple | Requis |
|-------|------|----------------|--------|
| Prenom | Input text | "Shahin" | Oui (*) |
| Format de date | Dropdown | DD.MM.YYYY | Non |
| Nom | Input text | "Gharbi" | Oui (*) |
| Pays | Dropdown | "France" | Non |
| Coordonnees | Input text | (vide) | Non |
| Langue | Dropdown | "French" | Non |
| Nom de l'entreprise | Input text | "Shahin" | Non |
| Fuseau horaire | Dropdown | "(UTC+02:00) Paris" | Non |
| E-mail | Input text | "gharbishahin73@gmail.com" | Oui (*) |
| Devise | Dropdown | "US dollar (USD)" | Non |
| Telephone | Input tel (prefixe pays FR) | "+33 7 82 21 49 92" | Non |
| Categorie d'entreprise | Dropdown | "Categorie d'entreprise" (placeholder) | Non |
| Nouveau mot de passe | Password + toggle visibilite | (placeholder: "Entrer le mot de passe") | Non |

---

### 12c. CONNECTER COMPTES (`/settings/services`)

**Titre**: "Connecter comptes"
**Barre de recherche**: "Entrez le nom du service" + icone loupe

**Integrations disponibles (grille 2 colonnes)**:

| Service | Logo | Description | Action |
|---------|------|-------------|--------|
| **Twilio SMS** | Logo Twilio rouge | Connecter Twilio pour configurer votre propre nom d'expediteur de SMS. Facturation separee. | "Connecter le compte" |
| **Mailgun** | Logo Mailgun rouge | Connecter Mailgun pour configurer votre propre nom d'expediteur d'email. Facturation separee. | "Connecter le compte" |
| **Custom SMTP** | Icone SMTP noir | Connecter votre compte SMTP pour personnaliser votre propre nom de l'expediteur de messagerie. | "Connecter le compte" |
| **WhatsApp Bot** | Logo WhatsApp vert | Ajoutez WhatsApp Bot pour connecter le bot. | "Connecter le compte" |
| **Facebook Messenger** | Logo Messenger violet | Ajoutez Facebook Messenger pour connecter le bot. | "Connecter le compte" |
| **Telegram Bot** | Logo Telegram bleu | Ajoutez Telegram pour connecter le bot. | "Connecter le compte" |

Chaque card d'integration a:
- Nom du service (titre)
- Logo officiel du service (coin droit)
- Description
- Lien "Instructions:" vers la doc du service
- Bouton noir "Connecter le compte" en bas

---

### 12d. PARAMETRES RFM (`/settings/rfm-segments`)

**Titre**: "Parametres RFM"
**Lien**: "En savoir plus sur RFM" (coin droit)

**Definitions**:
- **Frequence** = visites (a quelle frequence vos clients achetent chez vous)
- **Recence** = jours (il y a combien de temps vos clients vous ont achete quelque chose)

**Warning**: "La modification des parametres recalculera tous les segments"

**3 segments configurables (grille 3 colonnes)**:

| Segment | Frequence depuis | Frequence a | Recence depuis (jours) | Recence a (jours) |
|---------|-----------------|-------------|----------------------|-------------------|
| **RFM - Besoin d'attention** | 5 | 7 | 41 | 60 |
| **RFM - Loyal - regulier** | 5 | 7 | 21 | 40 |
| **RFM - Champions** | 5 | 7 | 0 | 20 |

Chaque segment a:
- Titre du segment
- 4 champs numeriques editables (frequence depuis/a, recence depuis/a)
- Bouton noir "Sauvegarder"

**Logique RFM**:
- Champions = clients qui achetent souvent ET recemment (0-20 jours)
- Loyal-regulier = achetent souvent, derniere visite 21-40 jours
- Besoin d'attention = achetent souvent mais pas vus depuis 41-60 jours

---

### 12e. NOTIFICATIONS (`/settings/notifications`)

**Titre**: "Notifications"
**Lien**: "A propos du rapport" (coin droit)

**Section "Vos parametres de notification"**:
- Checkbox vert (active): **"Rapport statistique hebdomadaire (email)"**
- Checkbox gris (desactive): **"Rapport statistique hebdomadaire (telegram)"**
  - Description: "Un message envoye par telegramme vous permettra de vous connecter au robot avec votre entreprise."
  - Lien: "Connecter" (pour lier le bot Telegram)

**Section "Parametres de notification client"**:
- Checkbox vert (active): **"Courriels transactionnels"**
  - Emails automatiques envoyes aux clients (confirmation carte, etc.)

---

## 13. FIRST PROMOTER / PROGRAMME D'AFFILIATION (`/first-promoter`)

### URL: `https://app.boomerangme.cards/first-promoter`
### Sous-navigation (7 onglets): Home | Referrals | Sub affiliates | Commissions | Payouts | Assets | Reports

**Note**: Cette page utilise un widget/iframe **FirstPromoter** (service tiers d'affiliation). L'interface est en anglais, pas en francais.

### Page Home

**KPIs (3 colonnes)**:
| KPI | Valeur |
|-----|--------|
| DUE IN 14 DAYS | $0 |
| TOTAL UNPAID | $0 |
| TOTAL PAID | $0 |

**Section "Pending agreement contracts"**:
- Checkbox: "I agree to affiliate terms & conditions"
- Bouton outline: "I agree"

**Section "Set up a payout method to get started."**:
- Description: "Please select your payout method to activate your account and get paid."
- Bouton outline: "Select Payout Method"

### Concept
- Programme d'affiliation ou les utilisateurs peuvent recommander BoomerangMe a d'autres marchands
- Commissions sur les ventes referees
- Systeme de sous-affilies (multi-niveaux)
- Tracking des referrals, commissions, paiements
- Assets marketing (liens, bannieres)
- Rapports de performance

---

## OBSERVATIONS UX DETAILLEES

### Design System Complet

**Palette de couleurs**:
| Usage | Couleur | Hex approximatif |
|-------|---------|-------------------|
| Fond app | Gris tres clair | #f5f5f5 / #fafafa |
| Top bar | Noir | #1a1a1a / #000000 |
| Sidebar fond | Rose-peche transparent | rgba(255,200,180,0.1) |
| Sidebar active | Gris fonce | #333333 |
| Boutons primaire | Noir | #000000 |
| Boutons secondaire | Blanc + bordure noire | #ffffff border #000 |
| Alerte rouge | Rouge vif | #ff0000 / #e53e3e |
| Succes/Actif | Vert | #00c853 / #22c55e |
| Warning | Orange | #ff9800 / #f59e0b |
| Badge gratuit | Bleu | #2196f3 / #3b82f6 |
| Texte principal | Noir | #1a1a1a |
| Texte secondaire | Gris | #666666 |
| Cards | Blanc | #ffffff |
| Bordures | Gris clair | #e0e0e0 / #e5e7eb |

**Typographie**:
- Logo: Font custom serif-bold "Boomerang"
- Titres: Sans-serif (probablement Inter ou similaire), bold/semibold
- Corps: Sans-serif, regular, ~14-16px
- Labels: Sans-serif, uppercase pour certains (ex: "STAMPS UNTIL THE REWARD")
- Tailles: ~24-28px titres, ~16px sous-titres, ~14px corps, ~12px labels

**Composants UI recurents**:

| Composant | Apparence | Utilisation |
|-----------|-----------|-------------|
| Bouton primaire | Noir plein, coins arrondis ~8px, texte blanc | Actions principales |
| Bouton secondaire | Blanc, bordure noire, coins arrondis | Actions secondaires |
| Bouton alerte | Rouge plein | Actions urgentes |
| Toggle | Pill verte quand ON, grise quand OFF | Activation/desactivation |
| Badge | Pill petit, couleur de fond | Status, labels |
| Card | Blanc, border-radius ~12px, shadow legere | Conteneurs de contenu |
| Onglets | Boutons pill horizontaux, noir=actif blanc=inactif | Navigation sous-sections |
| Radio button | Cercle vert quand selectionne | Selections exclusives |
| Dropdown | Champ avec chevron, fond blanc | Selections de valeurs |
| Input text | Bordure grise, coins arrondis | Saisie texte |
| Zone upload | Bordure tiretee, icone main+fichier | Upload de fichiers |
| Mockup iPhone | Frame noir realiste avec encoche | Preview des cartes |
| QR Code | Noir sur blanc, grande taille | Partage/scan |

**Patterns de layout**:
1. **Split editor**: Formulaire gauche (60%) + Preview droite (40%)
2. **Tabs navigation**: Onglets horizontaux en haut de chaque section
3. **Card grid**: Grille de cards pour les KPIs et les listes
4. **3-column inbox**: Layout type email pour la messagerie
5. **Flow builder**: Canvas zoomable avec blocs connectes
6. **Wizard**: Etapes lineaires pour la creation de carte

### Parcours utilisateur principaux

**Parcours 1: Creer une carte de fidelite**
1. Dashboard → Clic "Create card" (persistent en bas a gauche)
2. Etape 1: Choisir le type de carte (6 options)
3. Etape 2: Configurer les parametres (barcode, programme, expiration, wallet)
4. Etape 3: Designer la carte (tampons, images, logo, labels)
5. Etape 4: Ajouter les informations textuelles
6. Etape 5: Enregistrer et visualiser
7. Activer la carte → QR code genere

**Parcours 2: Distribuer une carte a un client**
1. Le marchand affiche le QR code (ecran, imprime, etc.)
2. Le client scanne le QR code
3. Le client choisit: Apple Wallet / Google Wallet / PWA
4. La carte s'installe sur le telephone du client

**Parcours 3: Scanner un client (employe)**
1. Un employe ouvre l'app scanner (probablement webapp separee)
2. Il scanne le barcode/QR de la carte du client
3. Il ajoute un tampon / valide une recompense
4. Le client recoit une notification push de mise a jour

**Parcours 4: Envoyer une notification push**
1. Aller sur une carte → onglet "Envoyer Push Notification"
2. Choisir le ciblage (tous ou segment)
3. Ecrire le message (avec emojis)
4. Optionnel: programmer l'envoi
5. Envoyer

**Parcours 5: Creer une automatisation**
1. Automations → "Creer une automatisation"
2. Definir le declencheur (ex: carte enregistree)
3. Ajouter un delai (ex: 5 minutes)
4. Ajouter une condition (ex: carte pas installee)
5. Definir l'action (ex: envoyer push de rappel)
6. Activer l'automatisation

---

## POINTS CLES POUR NOTRE SaaS (REPRODUCTION)

### Fonctionnalites MUST-HAVE (MVP)
1. **8 types de cartes** avec editeur complet (Tampon, Recompense, Adhesion, Remise, Cashback, Coupon, Cadeau, Multipass)
2. **Generaton Apple Wallet (.pkpass)** et **Google Wallet (JWT)**
3. **PWA fallback** pour les telephones sans wallet
4. **QR Code et PDF417** pour chaque carte
5. **Push notifications** gratuites via wallet
6. **Scanner webapp** pour les employes
7. **Dashboard** avec KPIs basiques
8. **Base clients** avec import/export
9. **Multi-tenant** (chaque business a son compte)

### Fonctionnalites NICE-TO-HAVE (V2)
1. **Flow builder** d'automatisations visuelles
2. **Segmentation RFM** avancee (3 segments: Champions, Loyal, Besoin d'attention)
3. **Boite de reception** type inbox (conversations clients)
4. **Emails marketing** (via Mailgun/Custom SMTP)
5. **Multi-locations** avec **Geo-Push** (notifications a 100m du point de vente)
6. **Gestion des managers** avec roles et sieges (10-50 selon plan)
7. **Programme d'affiliation** (FirstPromoter: referrals, commissions, sous-affilies)
8. **API et webhooks** (plan Business+)
9. **Multi-langue** (FR/EN)
10. **Preview live** dans mockup iPhone (Apple + Android)
11. **Integrations**: Twilio SMS, Mailgun, Custom SMTP, WhatsApp Bot, Facebook Messenger, Telegram Bot
12. **Marque blanche** + domaine custom (plan Agency+)
13. **Controle des doublons** (empecher un client d'avoir 2 cartes)
14. **Programme de parrainage client** (inviter des amis = points bonus)
15. **Stripe Connect / PayPal** pour les revendeurs (plan Franchise)

### Avantages concurrentiels a viser
1. **Interface en francais natif** (BoomerangMe est traduit, parfois mal)
2. **Apple Wallet** natif (BoomerangMe ne semble pas le mettre en avant dans les settings, seulement Google + PWA)
3. **Prix agressif** pour le marche francais
4. **Onboarding simplifie** (BoomerangMe est complexe)
5. **Support humain francais**

### Architecture technique suggeree
- **Frontend**: Next.js 14+ (App Router)
- **Backend**: Next.js API routes + Supabase
- **Base de donnees**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (images, logos)
- **Apple Wallet**: librairie `passkit-generator` (Node.js)
- **Google Wallet**: Google Wallet API (JWT)
- **Push**: via les wallet passes natifs (pas de Firebase necessaire)
- **QR Code**: librairie `qrcode` (Node.js)
- **Barcode PDF417**: librairie `pdf417-generator`
- **Deployment**: Vercel
- **Payments**: Stripe

### Schema de base de donnees (ebauche)
```
businesses (id, name, logo, address, owner_id, plan, created_at)
users (id, email, role, business_id)
cards (id, business_id, type, name, status, settings_json, design_json, barcode_type, created_at)
card_templates (id, card_id, stamp_count, reward_rules, expiration_type, expiration_value)
clients (id, business_id, name, email, phone, created_at)
card_instances (id, card_id, client_id, stamps_collected, rewards_earned, status, installed_at, wallet_type)
transactions (id, card_instance_id, type, value, scanned_by, created_at)
push_notifications (id, card_id, message, target_type, segment_id, scheduled_at, sent_at)
automations (id, business_id, name, trigger_type, steps_json, status, created_at)
locations (id, business_id, name, address, lat, lng)
managers (id, business_id, user_id, role, location_id)
```
