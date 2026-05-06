/**
 * Helpers couleur ET typo partagés entre le générateur Google Wallet (server)
 * et le composant `<CardPreview />` (client). Aucune dépendance Node/server
 * ici pour rester importable depuis un module client sans alourdir le bundle.
 */

/**
 * Normalise un label de wallet (Tampons / Visites / etc.) pour qu'il rentre
 * dans les slots étroits d'Apple/Google sans être tronqué bêtement.
 *
 * Stratégie :
 *   - vide / null  → fallback (par défaut "Tampons")
 *   - ≤ MAX chars  → utilisé tel quel
 *   - > MAX chars  → on prend le 1er mot, et si le 1er mot est lui-même trop
 *                    long on tronque ce mot avec "..." (cas extrême)
 *
 * Exemples avec MAX=14 :
 *   ""                           → "Tampons"
 *   "Tampons"                    → "Tampons"
 *   "Visites"                    → "Visites"
 *   "Tampons avant récompense"   → "Tampons"          (au lieu de "Tampons avant ré...")
 *   "Café offert tous les 10"    → "Café"
 *   "Achetez plus pour gagner"   → "Achetez"
 *   "Récompenses superlongues"   → "Récompenses…"
 */
export function shortLabel(
  raw: string | null | undefined,
  fallback: string = "Tampons",
  max: number = 14,
): string {
  const s = (raw ?? "").trim();
  if (!s) return fallback;
  if (s.length <= max) return s;
  const firstWord = s.split(/\s+/, 1)[0];
  if (firstWord.length <= max) return firstWord;
  return firstWord.slice(0, max - 1) + "…";
}

// Calcule la luminance perçue d'une couleur hex (0..1). >0.6 = couleur claire.
export function luminance(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex ?? "").trim());
  if (!m) return 0;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Assombrit une couleur hex de `factor` (0..1). 0.5 => -50% de luminosité.
export function darkenHex(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex ?? "").trim());
  if (!m) return "#1a1a1a";
  const k = Math.max(0, Math.min(1, 1 - factor));
  const r = Math.round(parseInt(m[1], 16) * k);
  const g = Math.round(parseInt(m[2], 16) * k);
  const b = Math.round(parseInt(m[3], 16) * k);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Couleur de fond effectivement envoyée à `hexBackgroundColor` côté Google
 * Wallet. Google ré-écrit toujours la couleur de texte par-dessus
 * (typiquement BLANC), donc un fond clair = texte invisible. On force un
 * fond sombre dérivé de l'accent merchant, ou `#1a1a1a` si l'accent est
 * lui aussi pâle.
 *
 * Cette logique est partagée avec le composant `<CardPreview platform="google" />`
 * pour que l'aperçu reflète exactement ce que l'utilisateur final verra.
 */
export function googleEffectiveBgColor(
  designBg: string | null | undefined,
  accentColor?: string | null
): string {
  const bg = (designBg ?? "").trim();
  if (bg && luminance(bg) <= 0.6) return bg;
  // Fond trop clair (ou absent) -> on tente de dériver un fond sombre depuis
  // l'accent merchant (50% darken). Si l'accent est lui aussi clair, fallback
  // safe sur "#1a1a1a".
  const accent = (accentColor ?? "").trim();
  if (accent) {
    const darkened = darkenHex(accent, 0.5);
    if (luminance(darkened) <= 0.6) return darkened;
  }
  return "#1a1a1a";
}
