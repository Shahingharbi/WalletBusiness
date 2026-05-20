# Captures landing page

Ce dossier contient toutes les images mises en avant sur la LP publique aswallet.fr.

## Fichiers actuels (générés via Playwright sur le compte test)

| Fichier | Source | Utilisé par |
|---|---|---|
| `dashboard-desktop.png` | Capture live de `aswallet.fr/dashboard` | `ProductShowcaseSection` (frame laptop) |
| `editor-desktop.png` | Capture live de `aswallet.fr/cards/[id]/edit` | `ProductShowcaseSection` (frame laptop) |
| `scanner-mobile.png` | Capture live de `aswallet.fr/scanner` mobile | (réserve) |
| `dashboard-mobile.png` | Capture live `/dashboard` mobile | (réserve) |
| `cards-mobile.png` | Capture live `/cards` mobile | (réserve) |
| `card-detail-desktop.png` | Capture live `/cards/[id]` | (réserve) |
| `wizard-step1-desktop.png` | Capture live `/cards/new` step 1 | (réserve) |
| `clients-desktop.png` | Capture live `/clients` | (réserve) |

Pour les regénérer : `node .qa/dashboard-audit/screen-landing.mjs`
(connecte avec le compte test, navigue, screenshote en 2× retina).

## Ajouter tes vraies captures Apple Wallet dans le Hero

Le composant `src/components/landing/HeroMockup.tsx` peut afficher
**tes vraies captures d'écran iPhone** au lieu des cartes CardPreview
reconstituées.

### Étapes

1. **Capture sur ton iPhone** une carte Apple Wallet ouverte (la mieux
   designée — Safari Burger, Kaptainfry, etc.). Bouton volume haut +
   bouton power pour le screenshot iPhone.
2. **Renomme** les fichiers exactement :
   - `wallet-front.png` (la carte qui sera au premier plan)
   - `wallet-back.png` (la carte qui sera décalée derrière, légèrement
     tournée)
3. **Dépose** les 2 fichiers ici dans `public/landing-mockups/`.
4. **Ouvre** `src/components/landing/HeroMockup.tsx` et change
   `const USE_REAL_PHOTOS = false;` → `true`.
5. **Commit + push** :
   ```
   git add public/landing-mockups/wallet-*.png src/components/landing/HeroMockup.tsx
   git commit -m "Hero : vraies captures Apple Wallet"
   git push origin main
   ```

Vercel rebuild ~2 min et le hero affiche tes vraies cartes dans des
frames iPhone (Dynamic Island, ombre portée, rotation légère).

### Pourquoi ne pas les avoir mises par défaut ?

Parce que je (Claude) ne peux pas écrire les images du chat vers le
filesystem. C'est une limitation du système — il faut que tu déposes
toi-même les fichiers, ça prend 30 secondes.

Le code est prêt à les recevoir.
