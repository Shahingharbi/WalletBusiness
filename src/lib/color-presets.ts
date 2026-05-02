/**
 * Curated color palettes for card design.
 * Each preset bundles a background_color + accent_color combination
 * that we know reads well on Apple Wallet & Google Wallet style cards.
 *
 * The text_color is derived automatically by the preview based on
 * background luminance, so we don't ship one per preset.
 */

export interface ColorPreset {
  id: string;
  label: string;
  background_color: string;
  accent_color: string;
  /** Optional explicit text color override — fallback is auto-contrast. */
  text_color?: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "creme",        label: "Crème",         background_color: "#fef3c7", accent_color: "#92400e", text_color: "#1a1a1a" },
  { id: "foret",        label: "Forêt",         background_color: "#064e3b", accent_color: "#fef9c3", text_color: "#ffffff" },
  { id: "ocean",        label: "Océan",         background_color: "#1e3a8a", accent_color: "#fef3c7", text_color: "#ffffff" },
  { id: "rose",         label: "Rosé",          background_color: "#fce7f3", accent_color: "#be185d", text_color: "#1a1a1a" },
  { id: "charbon",      label: "Charbon",       background_color: "#1f2937", accent_color: "#fbbf24", text_color: "#ffffff" },
  { id: "bordeaux",     label: "Bordeaux",      background_color: "#7f1d1d", accent_color: "#fef3c7", text_color: "#ffffff" },
  { id: "creme-vert",   label: "Crème + Vert",  background_color: "#f0fdf4", accent_color: "#166534", text_color: "#1a1a1a" },
  { id: "lavande",      label: "Lavande",       background_color: "#ede9fe", accent_color: "#5b21b6", text_color: "#1a1a1a" },
  { id: "sable",        label: "Sable",         background_color: "#fef3c7", accent_color: "#15803d", text_color: "#1a1a1a" },
  { id: "nuit-or",      label: "Nuit + Or",     background_color: "#18181b", accent_color: "#d4af37", text_color: "#ffffff" },
  { id: "pastel-rose",  label: "Pastel rose",   background_color: "#fff1f2", accent_color: "#f43f5e", text_color: "#1a1a1a" },
  { id: "menthe",       label: "Menthe",        background_color: "#ecfdf5", accent_color: "#047857", text_color: "#1a1a1a" },
];

const norm = (h: string) => (h || "").trim().toLowerCase();

/**
 * Best-effort match of a (bg, accent) pair to one of the presets.
 * Returns null if it's a custom combination.
 */
export function findMatchingPreset(
  bg: string,
  accent: string
): ColorPreset | null {
  const b = norm(bg);
  const a = norm(accent);
  return (
    COLOR_PRESETS.find(
      (p) =>
        norm(p.background_color) === b && norm(p.accent_color) === a
    ) ?? null
  );
}
