/**
 * Source-of-truth pour le rendu des tampons (forme + icône).
 *
 * Ce module est consommé à la fois par :
 *   - le composant React `card-preview.tsx` (aperçu in-app)
 *   - la route `/api/wallet/banner/.../route.tsx` (strip image rendue par Satori
 *     puis embarquée dans Apple Wallet et Google Wallet)
 *
 * Les deux doivent rendre la MÊME forme et la MÊME icône pour que l'aperçu
 * corresponde pixel pour pixel à la carte affichée dans le wallet du client.
 *
 * Pour rester compatible Satori (qui ne supporte pas les SVG nested ni les
 * clip-path complexes), on travaille uniquement en `<path d="..." />` dans un
 * seul `<svg viewBox="0 0 24 24">`. Tout est centré sur ce viewBox commun.
 */

export type StampShape = "circle" | "squircle" | "shield" | "star" | "hex";

export type StampIconKey =
  | "check"
  | "star"
  | "heart"
  | "coffee"
  | "pizza"
  | "flower"
  | "scissors"
  | "crown"
  | "leaf"
  | "gift"
  | "baguette"
  | "kebab"
  | "diamond"
  | "sparkle"
  | "circle";

const VALID_SHAPES: StampShape[] = ["circle", "squircle", "shield", "star", "hex"];

export function normalizeShape(s: unknown): StampShape {
  return typeof s === "string" && (VALID_SHAPES as string[]).includes(s)
    ? (s as StampShape)
    : "circle";
}

/**
 * Path SVG pour la FORME extérieure du tampon (24x24 viewBox).
 * Toutes les shapes sont calibrées pour occuper ~96% de la box, centrées.
 */
export function getShapePath(shape: StampShape): string {
  switch (shape) {
    case "squircle":
      // Carré arrondi (rx=6 sur 24x24 = ~25% radius).
      return "M6 1 H18 A5 5 0 0 1 23 6 V18 A5 5 0 0 1 18 23 H6 A5 5 0 0 1 1 18 V6 A5 5 0 0 1 6 1 Z";
    case "shield":
      return "M12 1.5 L21.5 4.5 V12 C21.5 17 17 21 12 22.5 C7 21 2.5 17 2.5 12 V4.5 Z";
    case "star":
      return "M12 1.5 L14.75 9.25 L22.75 9.5 L16.4 14.5 L18.75 22.25 L12 17.5 L5.25 22.25 L7.6 14.5 L1.25 9.5 L9.25 9.25 Z";
    case "hex":
      return "M12 1.5 L21.5 6.75 L21.5 17.25 L12 22.5 L2.5 17.25 L2.5 6.75 Z";
    case "circle":
    default:
      // Cercle exprimé comme path (Satori rend mieux les <path> que les <circle>
      // dans certains contextes — on uniformise).
      return "M12 1 A11 11 0 1 1 11.99 1 Z";
  }
}

/**
 * Path SVG pour l'ICÔNE intérieure du tampon (24x24 viewBox).
 * Tous les paths sont calibrés pour ~12-14 unités de large, centrés autour (12,12).
 * Style: fill solide (pas de stroke nécessaire) pour un rendu net dans Satori.
 */
export function getIconPath(key: StampIconKey | string | null | undefined): string {
  const k = (key ?? "check") as StampIconKey;
  switch (k) {
    case "check":
      // Une coche épaisse, lisible même petite.
      return "M9.55 17.6 L4.4 12.45 L6.2 10.65 L9.55 14 L17.8 5.75 L19.6 7.55 Z";
    case "star":
      return "M12 3 L14.6 9.4 L21.5 9.9 L16.2 14.45 L17.85 21.25 L12 17.55 L6.15 21.25 L7.8 14.45 L2.5 9.9 L9.4 9.4 Z";
    case "heart":
      return "M12 21 C12 21 3.5 15.4 3.5 9.4 A4.7 4.7 0 0 1 12 7 A4.7 4.7 0 0 1 20.5 9.4 C20.5 15.4 12 21 12 21 Z";
    case "coffee":
      // Tasse pleine.
      return "M4 8 H17 V15 A4 4 0 0 1 13 19 H8 A4 4 0 0 1 4 15 Z M17 9 H19 A3 3 0 0 1 19 15 H17 V13 H19 A1 1 0 0 0 19 11 H17 Z M6 3 H7 V6 H6 Z M9 3 H10 V6 H9 Z M12 3 H13 V6 H12 Z";
    case "pizza":
      // Triangle de pizza avec garniture.
      return "M12 3 L21 19 H3 Z M9.5 11 a1.1 1.1 0 1 1 0 0.01 Z M14 12 a1.1 1.1 0 1 1 0 0.01 Z M11.5 16 a1.1 1.1 0 1 1 0 0.01 Z";
    case "flower":
      return "M12 3 A3 3 0 0 1 14.5 7.5 A3 3 0 0 1 19 9 A3 3 0 0 1 16.5 12 A3 3 0 0 1 19 15 A3 3 0 0 1 14.5 16.5 A3 3 0 0 1 12 21 A3 3 0 0 1 9.5 16.5 A3 3 0 0 1 5 15 A3 3 0 0 1 7.5 12 A3 3 0 0 1 5 9 A3 3 0 0 1 9.5 7.5 A3 3 0 0 1 12 3 Z M12 10.5 A1.5 1.5 0 1 1 12 10.49 Z";
    case "scissors":
      // Approximation simple: deux lames + manches arrondis.
      return "M5 4 L19 18 L17 20 L11 14 L9 16 A3 3 0 1 1 7.5 14.5 L9.5 12.5 L5 8 Z M19 4 L13 10 L11 8 L17 2 Z M5 16 a3 3 0 1 1 0.01 0 Z";
    case "crown":
      return "M3 18 L5 8 L10 12 L12 5 L14 12 L19 8 L21 18 Z M3 19.5 H21 V21.5 H3 Z";
    case "leaf":
      return "M20 3 C13 3 7 7 7 14 C7 16 7.6 17.8 8.6 19.3 L5 22.9 L6.4 24.3 L10 20.7 C11.5 21.7 13.3 22.3 15 22.3 C19.5 22.3 21 16.8 21 10.8 C21 7.8 21.4 5 20 3 Z M9 16 C9 11 13 7 18 7 C17 13 13 16 9 16 Z";
    case "gift":
      return "M2 8 H22 V12 H2 Z M4 13 H20 V21 H4 Z M11 8 V21 H13 V8 Z M11 7 H13 C13 4 15 3 16.5 3 A2.5 2.5 0 1 1 16.5 8 H13 V7 Z M11 7 H7.5 A2.5 2.5 0 1 1 7.5 3 C9 3 11 4 11 7 Z";
    case "baguette":
      return "M18 3 C20 3 21 4 21 6 C21 6.8 20.7 7.5 20 8.2 L8 20.2 C7.4 20.8 6.6 21 6 21 C4 21 3 20 3 18 C3 17.2 3.3 16.5 4 15.8 L16 3.8 C16.6 3.2 17.4 3 18 3 Z M7 17 L9 19 M10 14 L12 16 M13 11 L15 13 M16 8 L18 10";
    case "kebab":
      // Brochette horizontale + cubes.
      return "M3 11 H21 V14 H3 Z M5 7.5 a2.5 2.5 0 1 1 0.01 0 Z M11 6.5 a3 3 0 1 1 0.01 0 Z M17.5 7.5 a2.5 2.5 0 1 1 0.01 0 Z M6 17 a2 2 0 1 1 0.01 0 Z M11.5 18 a2 2 0 1 1 0.01 0 Z M17.5 17 a2 2 0 1 1 0.01 0 Z";
    case "diamond":
      return "M6 3 H18 L22 9 L12 22 L2 9 Z";
    case "sparkle":
      return "M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z";
    case "circle":
      // Petit point central (utilisé comme fallback "vide" historique).
      return "M12 9 A3 3 0 1 1 11.99 9 Z";
    default:
      return "M9.55 17.6 L4.4 12.45 L6.2 10.65 L9.55 14 L17.8 5.75 L19.6 7.55 Z";
  }
}

/**
 * Liste des clés d'icônes valides — utilisée pour valider les valeurs venues
 * de la base de données (où le champ design est en JSONB libre).
 */
const VALID_ICON_KEYS = new Set<StampIconKey>([
  "check",
  "star",
  "heart",
  "coffee",
  "pizza",
  "flower",
  "scissors",
  "crown",
  "leaf",
  "gift",
  "baguette",
  "kebab",
  "diamond",
  "sparkle",
  "circle",
]);

export function normalizeIconKey(
  k: string | null | undefined,
  fallback: StampIconKey = "check",
): StampIconKey {
  if (!k) return fallback;
  return VALID_ICON_KEYS.has(k as StampIconKey) ? (k as StampIconKey) : fallback;
}
