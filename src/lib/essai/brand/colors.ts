/**
 * Couleurs de marque « exactes » : on MESURE les pixels du logo (ou de
 * l'image fournie) au lieu d'inventer une palette.
 *
 *  - `extractPalette(image)` : palette réelle de l'image (couleurs présentes
 *    dans les pixels, regroupées par proximité perceptuelle), la plus
 *    représentative d'abord.
 *  - `chooseBrandColors(...)` : choisit fond / texte / accent de la carte à
 *    partir de cette palette (+ theme-color du site, manifest, choix de l'IA),
 *    avec des contrastes WCAG garantis.
 *
 * Server-only (sharp).
 */

import sharp from "sharp";
import { darkenHex } from "@/lib/wallet-colors";
import type { BrandColors, PaletteColor } from "../types";

// ─── Conversions & mesures ────────────────────────────────────────────────

type Rgb = [number, number, number];
type Lab = [number, number, number];

const HEX6 = /^#[0-9a-f]{6}$/i;

/** `#rrggbb` strict (6 chiffres hex). Les autres formes passent par `normalizeHex`. */
export function isHexColor(s: unknown): s is string {
  return typeof s === "string" && HEX6.test(s.trim());
}

/**
 * Normalise une couleur CSS « simple » en `#rrggbb` minuscule :
 * `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()`. Renvoie null sinon
 * (couleurs nommées, `var(--x)`, dégradés… : on préfère ignorer que deviner).
 * Une couleur quasi transparente (alpha < 0,5) est ignorée : elle ne
 * correspond pas à ce que l'utilisateur voit.
 */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4})$/.exec(s);
  if (m) {
    const [r, g, b, a] = m[1].split("");
    if (a !== undefined && parseInt(a + a, 16) < 128) return null;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) {
    if (m[2] !== undefined && parseInt(m[2], 16) < 128) return null;
    return `#${m[1]}`;
  }
  m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map((v) => Number(v));
    if (rgb.some((v) => v > 255)) return null;
    if (m[4] !== undefined) {
      const alpha = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (!(alpha >= 0.5)) return null;
    }
    return rgbToHex(rgb as Rgb);
  }
  return null;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Luminance relative WCAG 2.x (0..1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

/** Ratio de contraste WCAG entre deux couleurs (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToLab([r, g, b]: Rgb): Lab {
  // sRGB → XYZ (D65) → CIELAB.
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labDistance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Écart perceptuel ΔE76 (CIELAB) entre deux couleurs hex. */
export function deltaE(a: string, b: string): number {
  return labDistance(rgbToLab(hexToRgb(a)), rgbToLab(hexToRgb(b)));
}

/** Saturation / luminosité HSL (0..1). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: Math.min(1, s), l };
}

/** Mélange linéaire (en sRGB) de `a` vers `b` (t = 0 → a, t = 1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex([
    ra[0] + (rb[0] - ra[0]) * t,
    ra[1] + (rb[1] - ra[1]) * t,
    ra[2] + (rb[2] - ra[2]) * t,
  ]);
}

// ─── Palette mesurée ──────────────────────────────────────────────────────

/** Deux teintes plus proches que ça (ΔE76) sont considérées identiques. */
const MERGE_DELTA_E = 12;
/** En dessous de cette part des pixels, la couleur est du bruit (anticrénelage). */
const MIN_RATIO = 0.01;
const MAX_COLORS = 8;
const SAMPLE_SIDE = 96;

/**
 * Réglages fins (optionnels) : pour une capture d'écran ou une photo, le logo
 * n'occupe que quelques % de l'image — on échantillonne plus large et on
 * garde des couleurs plus discrètes, afin que l'IA puisse les choisir.
 */
export interface PaletteOptions {
  /** Côté de l'échantillon (px). Défaut 96. */
  sampleSide?: number;
  /** Part minimale des pixels (0..1). Défaut 0,01. */
  minRatio?: number;
  /** Nombre max de couleurs renvoyées. Défaut 8. */
  maxColors?: number;
}

interface Cluster {
  /** Lab du premier (plus gros) bac : ancre fixe → pas de dérive du regroupement. */
  anchor: Lab;
  count: number;
  /** Couleur exacte la plus fréquente du groupe (valeur de pixel réelle). */
  rep: number;
  repCount: number;
}

/**
 * Palette d'un buffer RGBA brut (4 canaux). Exportée pour `logo.ts`, qui a
 * déjà les pixels décodés sous la main.
 *
 * Pourquoi « mode » plutôt que « moyenne » : la couleur renvoyée est une
 * valeur de pixel RÉELLEMENT présente (la plus fréquente du groupe), pas une
 * moyenne polluée par les pixels d'anticrénelage ou le bruit JPEG.
 */
export function paletteFromRgba(
  data: Uint8Array | Buffer,
  step = 1,
  opts: Pick<PaletteOptions, "minRatio" | "maxColors"> = {},
): PaletteColor[] {
  const minRatio = opts.minRatio ?? MIN_RATIO;
  const maxColors = opts.maxColors ?? MAX_COLORS;
  const exact = new Map<number, number>();
  let total = 0;
  const stride = 4 * Math.max(1, Math.floor(step));
  for (let i = 0; i + 3 < data.length; i += stride) {
    if (data[i + 3] < 128) continue; // pixels (quasi) transparents ignorés
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    exact.set(key, (exact.get(key) ?? 0) + 1);
    total++;
  }
  if (total === 0) return [];

  // 1. Quantification 4 bits / canal : chaque bac garde son total et sa
  //    couleur exacte dominante.
  const bins = new Map<number, { count: number; best: number; bestCount: number }>();
  for (const [key, count] of exact) {
    const bin = (((key >> 20) & 0xf) << 8) | (((key >> 12) & 0xf) << 4) | ((key >> 4) & 0xf);
    const cur = bins.get(bin);
    if (!cur) bins.set(bin, { count, best: key, bestCount: count });
    else {
      cur.count += count;
      if (count > cur.bestCount) {
        cur.best = key;
        cur.bestCount = count;
      }
    }
  }

  // 2. Regroupement glouton des bacs proches (ΔE76 < 12), du plus gros au
  //    plus petit : un aplat et ses pixels de bord finissent ensemble.
  const sorted = [...bins.values()].sort((a, b) => b.count - a.count);
  const clusters: Cluster[] = [];
  for (const bin of sorted) {
    const lab = rgbToLab(keyToRgb(bin.best));
    let target: Cluster | null = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      const d = labDistance(c.anchor, lab);
      if (d < bestDist) {
        bestDist = d;
        target = c;
      }
    }
    if (target && bestDist < MERGE_DELTA_E) {
      target.count += bin.count;
      if (bin.bestCount > target.repCount) {
        target.rep = bin.best;
        target.repCount = bin.bestCount;
      }
    } else {
      clusters.push({ anchor: lab, count: bin.count, rep: bin.best, repCount: bin.bestCount });
    }
  }

  return removeBlends(clusters)
    .map((c) => {
      const hex = rgbToHex(keyToRgb(c.rep));
      const { s, l } = hexToHsl(hex);
      return { hex, ratio: c.count / total, saturation: round3(s), lightness: round3(l) };
    })
    .filter((c) => c.ratio >= minRatio)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, maxColors)
    .map((c) => ({ ...c, ratio: round3(c.ratio) }));
}

/**
 * Supprime les couleurs d'anticrénelage : le bord d'un logo rouge sur blanc
 * produit des roses qui ne sont PAS des couleurs de la marque. Une petite
 * couleur située (en RVB) sur le segment entre deux couleurs plus présentes
 * est un mélange : ses pixels sont rendus à ses deux « parents ».
 * Garde-fou : seulement si elle pèse nettement moins que ses parents (une
 * vraie 3e couleur de marque n'est pas avalée).
 */
function removeBlends(clusters: Cluster[]): Cluster[] {
  const list = clusters.map((c) => ({ ...c })).sort((a, b) => b.count - a.count);
  const kept: Cluster[] = [];
  for (const c of list) {
    const pc = keyToRgb(c.rep);
    let blended = false;
    for (let i = 0; i < kept.length && !blended; i++) {
      for (let j = i + 1; j < kept.length && !blended; j++) {
        const a = kept[i];
        const b = kept[j];
        if (c.count > 0.5 * Math.min(a.count, b.count)) continue;
        const pa = keyToRgb(a.rep);
        const pb = keyToRgb(b.rep);
        const ab = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]];
        const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
        if (len2 === 0) continue;
        const t =
          ((pc[0] - pb[0]) * ab[0] + (pc[1] - pb[1]) * ab[1] + (pc[2] - pb[2]) * ab[2]) / len2;
        if (t <= 0.04 || t >= 0.96) continue;
        const dist = Math.hypot(
          pc[0] - (pb[0] + t * ab[0]),
          pc[1] - (pb[1] + t * ab[1]),
          pc[2] - (pb[2] + t * ab[2]),
        );
        if (dist < 24) {
          a.count += c.count * t;
          b.count += c.count * (1 - t);
          blended = true;
        }
      }
    }
    if (!blended) kept.push(c);
  }
  return kept;
}

function keyToRgb(key: number): Rgb {
  return [(key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Palette réelle d'une image (png/jpg/webp/gif/svg…), la plus représentative
 * d'abord. Ne lève jamais : image illisible → [].
 */
export async function extractPalette(
  image: Buffer,
  opts: PaletteOptions = {},
): Promise<PaletteColor[]> {
  const side = Math.max(16, Math.min(512, Math.round(opts.sampleSide ?? SAMPLE_SIDE)));
  try {
    // Réduction « plus proche voisin » : on ÉCHANTILLONNE des pixels réels au
    // lieu d'en moyenner (une moyenne inventerait des couleurs de bord).
    const { data } = await sharp(image, { failOn: "none", limitInputPixels: 50_000_000 })
      .rotate()
      .resize(side, side, { fit: "inside", withoutEnlargement: true, kernel: "nearest" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return paletteFromRgba(data, 1, opts);
  } catch (err) {
    console.warn("[essai/colors] palette impossible:", errMessage(err));
    return [];
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Choix des couleurs de la carte ───────────────────────────────────────

const WHITE = "#ffffff";
const DARK_TEXT = "#111111";
/** Fond « élégant » des marques monochromes (logo noir / blanc / gris). */
const MONO_BG = "#141414";
const AMBER = "#fbbf24";

/** Écart minimal (ΔE76) pour qu'un accent soit perçu comme une AUTRE couleur. */
const ACCENT_MIN_DELTA_E = 25;
/** Contraste minimal accent ↔ fond (tampons remplis bien visibles). */
const ACCENT_MIN_CONTRAST = 2.5;
/** Contraste minimal texte ↔ fond (WCAG AA texte normal). */
const TEXT_MIN_CONTRAST = 4.5;

function isNearWhite(hex: string): boolean {
  const { s, l } = hexToHsl(hex);
  return l >= 0.93 || (l >= 0.85 && s < 0.2);
}

function isNearBlack(hex: string): boolean {
  return hexToHsl(hex).l <= 0.1;
}

/** Couleur « de marque » utilisable comme fond : ni grise, ni extrême. */
function isBrandish(hex: string): boolean {
  const { s, l } = hexToHsl(hex);
  return s >= 0.25 && l >= 0.12 && l <= 0.85;
}

/**
 * Assombrit progressivement (même teinte) jusqu'à satisfaire `ok`.
 * Utilise `darkenHex` de lib/wallet-colors (même logique que Google Wallet).
 */
function darkenUntil(hex: string, ok: (c: string) => boolean): string {
  if (ok(hex)) return hex;
  for (let f = 0.05; f <= 0.95; f += 0.05) {
    const c = darkenHex(hex, f);
    if (ok(c)) return c;
  }
  return MONO_BG;
}

function uniqueHexes(list: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const hex = normalizeHex(raw);
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out;
}

/**
 * Choisit fond / texte / accent de la carte.
 *
 * Ordre pour la couleur principale (= fond) :
 *   1. `preferred` (couleurs choisies par l'IA DANS la palette mesurée) ;
 *   2. `theme-color` du site (si ni ~blanc ni ~noir) ;
 *   3. couleur la plus représentative du logo ayant du caractère
 *      (saturation ≥ 0,25, 0,12 ≤ L ≤ 0,85) ;
 *   4. couleur du manifest ayant du caractère ;
 *   5. logo monochrome → fond sombre élégant `#141414`.
 *
 * Garanties : texte ↔ fond ≥ 4,5:1 ; accent ↔ fond ≥ 2,5:1.
 */
export function chooseBrandColors(input: {
  palette: PaletteColor[];
  themeColor?: string | null;
  manifestColors?: string[];
  preferred?: (string | null)[];
}): BrandColors {
  const palette = (input.palette ?? []).filter((c) => isHexColor(c.hex));
  const preferred = uniqueHexes(input.preferred ?? []);
  const theme = normalizeHex(input.themeColor);
  const manifest = uniqueHexes(input.manifestColors ?? []);

  // 1. Couleur principale.
  let primary: string | null =
    preferred.find((c) => !isNearWhite(c)) ?? null;
  if (!primary && theme && !isNearWhite(theme) && !isNearBlack(theme)) primary = theme;
  if (!primary) {
    primary =
      palette.find((c) => c.saturation >= 0.25 && c.lightness >= 0.12 && c.lightness <= 0.85)
        ?.hex.toLowerCase() ?? null;
  }
  if (!primary) primary = manifest.find(isBrandish) ?? null;
  if (!primary) primary = MONO_BG;

  // 2. Fond = principale ; une couleur très pâle (L > 0,8) est assombrie
  //    jusqu'à porter un texte blanc lisible (Google Wallet impose de toute
  //    façon un fond sombre, cf. googleEffectiveBgColor). Un quasi-blanc
  //    assombri donnerait un gris sale → fond monochrome élégant à la place.
  let background = primary;
  if (hexToHsl(background).l > 0.8) {
    background = isNearWhite(background)
      ? MONO_BG
      : darkenUntil(background, (c) => contrastRatio(c, WHITE) >= TEXT_MIN_CONTRAST);
  }

  // 3. Texte : blanc dès qu'il est lisible (rendu « premium » sur wallet),
  //    sinon quasi-noir ; si aucun des deux n'atteint 4,5:1 (tons moyens),
  //    on assombrit légèrement le fond plutôt que de sacrifier la lisibilité.
  let text: string;
  if (contrastRatio(background, WHITE) >= TEXT_MIN_CONTRAST) text = WHITE;
  else if (contrastRatio(background, DARK_TEXT) >= TEXT_MIN_CONTRAST) text = DARK_TEXT;
  else {
    background = darkenUntil(background, (c) => contrastRatio(c, WHITE) >= TEXT_MIN_CONTRAST);
    text = WHITE;
  }

  // 4. Accent : 2e couleur réellement présente, nettement différente du fond
  //    et bien visible dessus. Les couleurs « de marque » passent avant les
  //    neutres (un logo bleu + jaune sur fond blanc → accent jaune, pas blanc).
  const accentOk = (c: string) =>
    deltaE(c, background) >= ACCENT_MIN_DELTA_E &&
    contrastRatio(c, background) >= ACCENT_MIN_CONTRAST;
  const paletteHexes = palette.map((c) => c.hex.toLowerCase());
  const chromatic = (c: string) => {
    const { s, l } = hexToHsl(c);
    return s >= 0.25 && l >= 0.12 && l <= 0.92;
  };
  const candidates = [
    // Fond assombri (couleur pâle) : la couleur d'origine, exacte, fait un
    // accent ton sur ton naturel.
    ...(background !== primary ? [primary] : []),
    ...preferred.filter((c) => c !== primary),
    ...paletteHexes.filter(chromatic),
    ...manifest.filter(chromatic),
    ...(theme && chromatic(theme) ? [theme] : []),
    ...paletteHexes.filter((c) => !chromatic(c)),
  ];
  let accent = candidates.find(accentOk) ?? null;

  if (!accent) {
    const { h, s } = hexToHsl(primary);
    const dark = relativeLuminance(background) < 0.18;
    // Un jaune assombri vire au kaki : sur fond jaune on passe directement au
    // quasi-noir ci-dessous (et Google, qui assombrit l'accent pour son fond,
    // affichera une carte noire plutôt qu'olive).
    const yellowish = !dark && h >= 40 && h <= 75;
    if (s >= 0.15 && !yellowish) {
      // Variante de la principale : éclaircie sur fond sombre, sinon assombrie.
      const variant = dark ? mixHex(primary, WHITE, 0.45) : darkenHex(primary, 0.45);
      if (contrastRatio(variant, background) >= ACCENT_MIN_CONTRAST) accent = variant;
    }
  }
  if (!accent) {
    // Marque monochrome ou variante trop proche : blanc (neutre, pas
    // d'invention), sinon ambre, sinon quasi-noir sur fond clair.
    accent =
      [WHITE, AMBER, DARK_TEXT].find(
        (c) => contrastRatio(c, background) >= ACCENT_MIN_CONTRAST,
      ) ?? WHITE;
  }

  return {
    background: background.toLowerCase(),
    text,
    accent: accent.toLowerCase(),
  };
}
