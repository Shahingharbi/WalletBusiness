/**
 * Logo de la carte d'essai : PNG carré 512×512, prêt pour Apple / Google Wallet.
 *
 *  - `prepareLogo(candidates)` : télécharge les logos trouvés sur le site /
 *    la fiche (ordre de confiance de l'appelant), rejette ce qui n'est pas un
 *    logo (minuscule, vide, photo) et normalise le meilleur.
 *  - `logoFromImage(image, box)` : logo tiré d'une image envoyée (photo,
 *    capture Instagram) — recadré sur `box` si l'IA l'a localisé.
 *  - `logoFromUpload(image)` : logo déposé — TOUTE image acceptée, badge 512 ;
 *  - `logoFromAvatar(image, box | null)` : photo de profil ronde d'une capture
 *    Instagram / Facebook → badge propre (masque rond, sans l'interface) ;
 *  - `googleFaviconCandidate(host)` : icône via le service de Google, pour les
 *    sites qui bloquent les robots ;
 *  - `typographicLogo(name, colors)` : initiales sur badge arrondi, quand
 *    aucun vrai logo n'est exploitable.
 *
 * Normalisation (pourquoi) :
 *  - logo TRANSPARENT → posé sur un badge arrondi contrasté : sans fond, un
 *    logo noir disparaît sur une carte sombre (et inversement) ;
 *  - logo OPAQUE sur fond uni → recadré puis re-centré sur SON fond (couleur
 *    mesurée), coins arrondis : on ne coupe jamais un logo horizontal ;
 *  - logo OPAQUE pleine page (apple-touch-icon…) → carré centré, coins arrondis.
 * Les coins sont transparents : rendu « icône d'app » propre sur les deux wallets.
 *
 * Server-only (sharp, fetch, next/og).
 */

import { createElement } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getIconPath } from "@/lib/stamp-render";
import type { BrandColors, BrandLogo, LogoCandidate, UploadedImage } from "../types";
import { contrastRatio, isHexColor, paletteFromRgba } from "./colors";
import { safeFetch } from "./safe-fetch";

// ─── Réglages ─────────────────────────────────────────────────────────────

const SIZE = 512;
/** Rayon des coins ~22 % (proche des icônes iOS). */
const RADIUS = Math.round(SIZE * 0.22);
/** Marge intérieure autour du logo sur badge / tuile. */
const MARGIN = 0.14;
/** Logo très horizontal (ou vertical) : marge réduite pour rester lisible. */
const MARGIN_WIDE = 0.1;
const MIN_SOURCE_SIDE = 48;
/** Agrandissement max « confortable » : au-delà, on cherche un meilleur candidat. */
const GOOD_UPSCALE = 3;
const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_CANDIDATES = 8;
const RASTER_MAX = 1024;
/** Les SVG sont rendus plus grand : leur contenu utile est souvent petit dans le viewBox. */
const SVG_RASTER_MAX = 1536;
/** Au-delà de 8 % de pixels transparents, l'image est un logo « détouré ». */
const TRANSPARENT_MIN_RATIO = 0.08;
/** Nb de bacs de couleur couvrant 85 % des pixels au-delà duquel on a une photo. */
const PHOTO_COMPLEXITY = 48;
const BADGE_LIGHT = "#ffffff";
const BADGE_DARK = "#141414";

type Box = { x: number; y: number; w: number; h: number };

interface Raster {
  /** RGBA brut (4 canaux). */
  data: Buffer;
  width: number;
  height: number;
}

interface Decoded {
  raster: Raster;
  isSvg: boolean;
  /** Dimensions d'origine (avant réduction) — pour juger la résolution. */
  sourceWidth: number;
  sourceHeight: number;
}

interface Analysis {
  hasTransparency: boolean;
  /** Boîte englobante des pixels visibles (alpha ≥ 16). */
  alphaBox: Box | null;
  /** Fond uni détecté sur le pourtour (images opaques). */
  borderColor: string | null;
  /** Bacs de couleur nécessaires pour couvrir 85 % des pixels opaques. */
  complexity: number;
}

/** Logo normalisé + image source recadrée (sans badge) pour mesurer la palette. */
export interface PreparedLogo {
  logo: BrandLogo;
  /** PNG du logo seul (avant badge / tuile) : base de `extractPalette`. */
  source: Buffer;
}

// ─── Téléchargement & décodage ────────────────────────────────────────────

function isPng(b: Buffer): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function isIco(b: Buffer): boolean {
  return b.length > 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0;
}

function looksLikeSvg(b: Buffer): boolean {
  const head = b.subarray(0, 2048).toString("utf8").trimStart().toLowerCase();
  return head.includes("<svg") && !head.startsWith("<!doctype html") && !head.startsWith("<html");
}

function looksLikeHtml(b: Buffer): boolean {
  const head = b.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<head");
}

/**
 * Les SVG inline extraits d'une page HTML n'ont souvent pas de `xmlns` :
 * librsvg (sharp) refuse alors de les lire. On l'ajoute si besoin.
 */
function ensureSvgNamespace(svg: string): string {
  let out = svg.trim();
  if (!/<svg[^>]*\sxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(out)) {
    out = out.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (/xlink:href/i.test(out) && !/xmlns:xlink=/i.test(out)) {
    out = out.replace(/<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  return out;
}

/**
 * Un .ico est un conteneur : les icônes modernes y embarquent des PNG.
 * On extrait le plus grand ; les entrées BMP historiques sont ignorées
 * (sharp ne sait pas les lire et elles sont minuscules de toute façon).
 */
function extractPngFromIco(buf: Buffer): Buffer | null {
  const count = buf.readUInt16LE(4);
  let best: Buffer | null = null;
  let bestArea = 0;
  for (let i = 0; i < Math.min(count, 64); i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > buf.length) break;
    const w = buf[entry] || 256;
    const h = buf[entry + 1] || 256;
    const size = buf.readUInt32LE(entry + 8);
    const offset = buf.readUInt32LE(entry + 12);
    if (offset + size > buf.length || size < 8) continue;
    const img = buf.subarray(offset, offset + size);
    if (isPng(img) && w * h > bestArea) {
      best = Buffer.from(img);
      bestArea = w * h;
    }
  }
  return best;
}

/** `data:image/png;base64,…` (logos inline dans le HTML). */
function decodeDataUrl(url: string): Buffer | null {
  const m = /^data:([^,]*?),(.*)$/i.exec(url.trim());
  if (!m) return null;
  try {
    const isBase64 = /;base64$/i.test(m[1]);
    const buf = isBase64
      ? Buffer.from(m[2], "base64")
      : Buffer.from(decodeURIComponent(m[2]), "utf8");
    return buf.length > 0 && buf.length <= MAX_LOGO_BYTES ? buf : null;
  } catch {
    return null;
  }
}

async function loadCandidateBytes(c: LogoCandidate): Promise<Buffer | null> {
  if (c.svg) {
    const buf = Buffer.from(ensureSvgNamespace(c.svg), "utf8");
    return buf.length <= MAX_LOGO_BYTES ? buf : null;
  }
  if (!c.url) return null;
  if (c.url.startsWith("data:")) return decodeDataUrl(c.url);
  try {
    const res = await safeFetch(c.url, {
      maxBytes: MAX_LOGO_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
    });
    if (res.status < 200 || res.status >= 300) return null;
    const ct = res.contentType.toLowerCase();
    // Une page HTML (404 « jolie », redirection vers l'accueil…) n'est pas un logo.
    if (ct.includes("text/html") || looksLikeHtml(res.body)) return null;
    if (!ct.startsWith("image/") && !looksLikeSvg(res.body) && !isIco(res.body)) {
      // Beaucoup de CDN servent les images en application/octet-stream :
      // on laisse sharp trancher plus loin.
      if (!ct.includes("octet-stream") && ct !== "") return null;
    }
    return res.body;
  } catch {
    return null;
  }
}

/**
 * Décode n'importe quel format raisonnable en RGBA brut, côté max `maxSide`.
 * Renvoie null si illisible (sharp lève sur les formats inconnus).
 */
async function decodeImage(input: Buffer, maxSide = RASTER_MAX): Promise<Decoded | null> {
  let bytes = input;
  if (isIco(bytes)) {
    const png = extractPngFromIco(bytes);
    if (!png) return null;
    bytes = png;
  }
  const isSvg = !isPng(bytes) && looksLikeSvg(bytes);
  try {
    let pipeline: sharp.Sharp;
    let sourceWidth: number;
    let sourceHeight: number;
    if (isSvg) {
      // Densité calculée pour rendre le SVG directement à la bonne taille
      // (net, sans agrandissement d'un petit raster).
      const svgMax = Math.max(maxSide, SVG_RASTER_MAX);
      let density = 288;
      try {
        const meta = await sharp(bytes, { failOn: "none" }).metadata();
        const side = Math.max(meta.width ?? 0, meta.height ?? 0);
        if (side > 0) density = Math.min(2400, Math.max(1, (72 * svgMax) / side));
      } catch {
        // Dimensions illisibles : la densité par défaut fera l'affaire.
      }
      pipeline = sharp(bytes, { failOn: "none", density }).resize(svgMax, svgMax, {
        fit: "inside",
        withoutEnlargement: true,
      });
      sourceWidth = Infinity;
      sourceHeight = Infinity;
    } else {
      const base = sharp(bytes, { failOn: "none", animated: false, limitInputPixels: 50_000_000 });
      const meta = await base.metadata();
      sourceWidth = meta.width ?? 0;
      sourceHeight = meta.height ?? 0;
      // `.rotate()` applique l'orientation EXIF (photos de téléphone).
      pipeline = base.rotate().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
    }
    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height) return null;
    return {
      raster: { data, width: info.width, height: info.height },
      isSvg,
      sourceWidth,
      sourceHeight,
    };
  } catch {
    return null;
  }
}

// ─── Analyse des pixels ───────────────────────────────────────────────────

function analyze(r: Raster): Analysis | null {
  const { data, width, height } = r;
  const total = width * height;
  let transparent = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a < 128) transparent++;
      if (a >= 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const opaqueRatio = 1 - transparent / total;
  // Entièrement (ou quasi) transparent : placeholder de lazy-loading, pixel espion…
  if (opaqueRatio < 0.005 || maxX < 0) return null;
  const alphaBox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  const hasTransparency = transparent / total >= TRANSPARENT_MIN_RATIO;

  // Complexité des couleurs (échantillonnage ~20 000 pixels).
  const step = Math.max(1, Math.floor(total / 20_000));
  const bins = new Map<number, number>();
  let samples = 0;
  for (let p = 0; p < total; p += step) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    bins.set(key, (bins.get(key) ?? 0) + 1);
    samples++;
  }
  const counts = [...bins.values()].sort((a, b) => b - a);
  let covered = 0;
  let complexity = 0;
  for (const c of counts) {
    covered += c;
    complexity++;
    if (covered >= samples * 0.85) break;
  }

  return {
    hasTransparency,
    alphaBox,
    borderColor: hasTransparency ? null : uniformBorderColor(r),
    complexity,
  };
}

/**
 * Couleur du pourtour si elle est uniforme (≥ 90 % des pixels de bord à
 * ±28 par canal de la couleur dominante) — typiquement un logo exporté sur
 * fond blanc ou une tuile de couleur. Moyenne des pixels conformes : absorbe
 * le bruit JPEG.
 */
function uniformBorderColor(r: Raster): string | null {
  const { data, width, height } = r;
  const px: number[] = [];
  const push = (x: number, y: number) => px.push((y * width + x) * 4);
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    push(0, y);
    push(width - 1, y);
  }
  const bins = new Map<number, number>();
  for (const i of px) {
    if (data[i + 3] < 200) return null; // bord transparent : pas un fond uni opaque
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let modeKey = -1;
  let modeCount = 0;
  for (const [k, c] of bins) {
    if (c > modeCount) {
      modeKey = k;
      modeCount = c;
    }
  }
  const ref = [((modeKey >> 10) << 3) + 4, (((modeKey >> 5) & 31) << 3) + 4, ((modeKey & 31) << 3) + 4];
  let n = 0;
  const sum = [0, 0, 0];
  for (const i of px) {
    if (
      Math.abs(data[i] - ref[0]) <= 28 &&
      Math.abs(data[i + 1] - ref[1]) <= 28 &&
      Math.abs(data[i + 2] - ref[2]) <= 28
    ) {
      n++;
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
    }
  }
  if (n < px.length * 0.9) return null;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${hex(sum[0])}${hex(sum[1])}${hex(sum[2])}`;
}

/** Boîte des pixels qui se distinguent du fond uni `bg`. */
function contentBoxOnBackground(r: Raster, bg: string): Box | null {
  const { data, width, height } = r;
  const ref = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (
        Math.abs(data[i] - ref[0]) > 32 ||
        Math.abs(data[i + 1] - ref[1]) > 32 ||
        Math.abs(data[i + 2] - ref[2]) > 32
      ) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  // Contenu minuscule (quelques pixels de bruit) : pas un logo.
  if ((maxX - minX + 1) * (maxY - minY + 1) < width * height * 0.002) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Table sRGB 8 bits → linéaire, pour la luminance relative pixel par pixel. */
const LINEAR = Array.from({ length: 256 }, (_, c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
});

/**
 * Badge sous un logo transparent : blanc, sauf si le logo est majoritairement
 * clair (logo blanc pour header sombre, jaune pâle…) → `#141414`.
 * « Clair » = contraste < 1,6:1 avec le blanc, c.-à-d. quasi invisible dessus.
 */
function badgeColorFor(r: Raster, box: Box): string {
  const { data, width } = r;
  let opaque = 0;
  let light = 0;
  const step = Math.max(1, Math.floor((box.w * box.h) / 40_000));
  let k = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (k++ % step !== 0) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      opaque++;
      const lum = 0.2126 * LINEAR[data[i]] + 0.7152 * LINEAR[data[i + 1]] + 0.0722 * LINEAR[data[i + 2]];
      if (1.05 / (lum + 0.05) < 1.6) light++;
    }
  }
  return opaque > 0 && light / opaque > 0.5 ? BADGE_DARK : BADGE_LIGHT;
}

// ─── Composition ──────────────────────────────────────────────────────────

function roundedRectSvg(fill: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">` +
      `<rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="${fill}"/></svg>`,
  );
}

function rawInput(r: Raster) {
  return { raw: { width: r.width, height: r.height, channels: 4 as const } };
}

/** PNG du raster recadré sur `box`. */
async function cropToPng(r: Raster, box: Box): Promise<Buffer> {
  return sharp(r.data, rawInput(r))
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .png()
    .toBuffer();
}

/** Pose `content` (PNG) centré dans un carré arrondi de couleur `fill`. */
async function composeOnTile(content: Buffer, fill: string, aspect: number): Promise<Buffer> {
  const margin = aspect > 2.2 || aspect < 1 / 2.2 ? MARGIN_WIDE : MARGIN;
  const inner = Math.round(SIZE * (1 - 2 * margin));
  const { data, info } = await sharp(content)
    .resize(inner, inner, { fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp(roundedRectSvg(fill))
    .composite([
      {
        input: data,
        left: Math.round((SIZE - info.width) / 2),
        top: Math.round((SIZE - info.height) / 2),
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

/** Agrandissement nécessaire pour faire tenir `w×h` (px source) dans le badge. */
function upscaleFactor(w: number, h: number): number {
  const inner = SIZE * (1 - 2 * MARGIN);
  return Math.min(inner / w, inner / h);
}

/**
 * Normalise un raster décodé. `strict` (candidats web) : rejette les photos
 * et les images trop petites ; désactivé pour un recadrage explicite.
 */
async function normalize(
  decoded: Decoded,
  opts: { strict: boolean; kind?: LogoCandidate["kind"]; badgeHint?: string | null },
): Promise<(PreparedLogo & { upscale: number }) | null> {
  const r = decoded.raster;
  const analysis = analyze(r);
  if (!analysis || !analysis.alphaBox) return null;

  // Rapport px source / px raster (le raster a pu être réduit à 1024).
  const scale = decoded.isSvg ? Infinity : decoded.sourceWidth / r.width || 1;

  if (opts.strict) {
    if (!decoded.isSvg && Math.min(decoded.sourceWidth, decoded.sourceHeight) < MIN_SOURCE_SIDE) {
      return null;
    }
    const aspect = r.width / r.height;
    // og:image : seulement si quasi carrée (sinon c'est une bannière / photo).
    if (opts.kind === "og-image" && (aspect > 1.3 || aspect < 0.77)) return null;
    // Une photo (beaucoup de couleurs, aucune transparence, pas de fond uni)
    // n'est pas un logo. Les icônes déclarées comme telles restent acceptées :
    // ce sont des icônes d'app, même dégradées.
    const iconKinds: LogoCandidate["kind"][] = ["apple-touch-icon", "manifest-icon", "icon", "favicon"];
    const isIconKind = opts.kind !== undefined && iconKinds.includes(opts.kind);
    if (
      !isIconKind &&
      !analysis.hasTransparency &&
      !analysis.borderColor &&
      analysis.complexity > PHOTO_COMPLEXITY
    ) {
      return null;
    }
  }

  // A. Logo détouré → badge contrasté.
  if (analysis.hasTransparency) {
    const box = analysis.alphaBox;
    const source = await cropToPng(r, box);
    let badge = badgeColorFor(r, box);
    // Logo clair (blanc…) : badge à la couleur de la marque plutôt que noir,
    // si elle le fait ressortir (contraste ≥ 3:1 avec le blanc).
    const hint = opts.badgeHint;
    if (badge === BADGE_DARK && hint && isHexColor(hint) && contrastRatio(hint, BADGE_LIGHT) >= 3) badge = hint;
    const png = await composeOnTile(source, badge, box.w / box.h);
    return {
      logo: { png, width: SIZE, height: SIZE, kind: "real" },
      source,
      upscale: upscaleFactor(box.w * scale, box.h * scale),
    };
  }

  // B. Opaque sur fond uni → recadré puis re-centré sur son propre fond.
  if (analysis.borderColor) {
    const box = contentBoxOnBackground(r, analysis.borderColor);
    if (!box) return null; // image unie : rien à montrer
    const source = await sharp(await cropToPng(r, box))
      .flatten({ background: analysis.borderColor })
      .png()
      .toBuffer();
    const png = await composeOnTile(source, analysis.borderColor, box.w / box.h);
    return {
      logo: { png, width: SIZE, height: SIZE, kind: "real" },
      source,
      upscale: upscaleFactor(box.w * scale, box.h * scale),
    };
  }

  // C. Opaque pleine page (icône d'app, avatar…) → carré centré, coins arrondis.
  const side = Math.min(r.width, r.height);
  const square = await sharp(r.data, rawInput(r))
    .resize(SIZE, SIZE, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .png()
    .toBuffer();
  const png = await sharp(square)
    .composite([{ input: roundedRectSvg("#ffffff"), blend: "dest-in" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  return {
    logo: { png, width: SIZE, height: SIZE, kind: "real" },
    source: square,
    upscale: SIZE / (side * scale),
  };
}

// ─── API publique ─────────────────────────────────────────────────────────

/**
 * Meilleur logo parmi les candidats (déjà triés par confiance). Les premiers
 * candidats sont téléchargés en parallèle (budget temps), puis évalués dans
 * l'ordre : le premier assez net gagne ; sinon le moins pixelisé des
 * acceptables. Variante détaillée : renvoie aussi la source pour la palette.
 * `badgeHint` (couleur de thème du site) : badge d'un logo clair détouré.
 */
export async function prepareLogoWithSource(
  candidates: LogoCandidate[],
  opts: { badgeHint?: string | null } = {},
): Promise<PreparedLogo | null> {
  const seen = new Set<string>();
  const list = candidates
    .filter((c) => {
      const key = c.svg ? `svg:${c.svg.length}:${c.svg.slice(0, 200)}` : c.url ?? "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CANDIDATES);
  if (list.length === 0) return null;

  const downloads = await Promise.all(list.map((c) => loadCandidateBytes(c)));

  let fallback: (PreparedLogo & { upscale: number }) | null = null;
  for (let i = 0; i < list.length; i++) {
    const bytes = downloads[i];
    if (!bytes) continue;
    try {
      const decoded = await decodeImage(bytes);
      if (!decoded) continue;
      const result = await normalize(decoded, { strict: true, kind: list[i].kind, badgeHint: opts.badgeHint });
      if (!result) continue;
      if (result.upscale <= GOOD_UPSCALE) return { logo: result.logo, source: result.source };
      if (!fallback || result.upscale < fallback.upscale) fallback = result;
    } catch (err) {
      console.warn("[essai/logo] candidat ignoré:", err instanceof Error ? err.message : err);
    }
  }
  return fallback ? { logo: fallback.logo, source: fallback.source } : null;
}

export async function prepareLogo(candidates: LogoCandidate[]): Promise<BrandLogo | null> {
  return (await prepareLogoWithSource(candidates))?.logo ?? null;
}

/** Une image « ressemble à un logo » : ≤ 6 couleurs dominantes couvrent > 85 %. */
function looksLikeLogo(r: Raster): boolean {
  const step = Math.max(1, Math.floor((r.width * r.height) / 20_000));
  const palette = paletteFromRgba(r.data, step);
  const top = palette.slice(0, 6).reduce((sum, c) => sum + c.ratio, 0);
  return top > 0.85;
}

/**
 * Logo tiré d'une image fournie par l'utilisateur. Avec `box` (coordonnées
 * relatives 0..1, ex. photo de profil Instagram repérée par l'IA) : recadre
 * cette zone + 6 % de marge. Sans `box` : n'accepte l'image que si elle
 * ressemble à un logo (transparence ou peu de couleurs), sinon null.
 */
export async function logoFromImageWithSource(
  image: Buffer,
  box?: { x: number; y: number; w: number; h: number } | null,
): Promise<PreparedLogo | null> {
  try {
    const decoded = await decodeImage(image, 2048);
    if (!decoded) return null;
    const r = decoded.raster;

    if (box) {
      const valid = [box.x, box.y, box.w, box.h].every((v) => Number.isFinite(v));
      if (!valid || box.w <= 0 || box.h <= 0) return null;
      const mx = box.w * 0.06;
      const my = box.h * 0.06;
      const x0 = Math.max(0, Math.min(1, box.x - mx));
      const y0 = Math.max(0, Math.min(1, box.y - my));
      const x1 = Math.max(0, Math.min(1, box.x + box.w + mx));
      const y1 = Math.max(0, Math.min(1, box.y + box.h + my));
      const crop = {
        x: Math.round(x0 * r.width),
        y: Math.round(y0 * r.height),
        w: Math.round((x1 - x0) * r.width),
        h: Math.round((y1 - y0) * r.height),
      };
      crop.w = Math.min(crop.w, r.width - crop.x);
      crop.h = Math.min(crop.h, r.height - crop.y);
      if (crop.w < 24 || crop.h < 24) return null;
      const { data, info } = await sharp(r.data, rawInput(r))
        .extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const cropped: Decoded = {
        raster: { data, width: info.width, height: info.height },
        isSvg: decoded.isSvg,
        sourceWidth: decoded.isSvg ? Infinity : info.width * (decoded.sourceWidth / r.width || 1),
        sourceHeight: decoded.isSvg ? Infinity : info.height * (decoded.sourceHeight / r.height || 1),
      };
      const result = await normalize(cropped, { strict: false });
      return result ? { logo: result.logo, source: result.source } : null;
    }

    const analysis = analyze(r);
    if (!analysis) return null;
    // Les deux critères : une photo terne peut tenir en 6 groupes de teintes
    // proches, mais elle reste très « complexe » au niveau des pixels.
    const logoLike =
      analysis.hasTransparency ||
      (analysis.complexity <= PHOTO_COMPLEXITY && looksLikeLogo(r));
    if (!logoLike) return null;
    const result = await normalize(decoded, { strict: false });
    return result ? { logo: result.logo, source: result.source } : null;
  } catch (err) {
    console.warn("[essai/logo] image illisible:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function logoFromImage(
  image: Buffer,
  box?: { x: number; y: number; w: number; h: number } | null,
): Promise<BrandLogo | null> {
  return (await logoFromImageWithSource(image, box))?.logo ?? null;
}

// ─── Logo déposé ──────────────────────────────────────────────────────────

/** Image déposée illisible (format inconnu, fichier corrompu). Message affichable. */
export class LogoReadError extends Error {
  constructor() {
    super("Ce logo n'a pas pu être lu. Essayez avec une autre image (PNG ou JPG).");
    this.name = "LogoReadError";
  }
}

/** Carré centré aux coins arrondis (photo, avatar, image sans fond uni). */
async function squareBadge(r: Raster): Promise<PreparedLogo> {
  const square = await sharp(r.data, rawInput(r))
    .resize(SIZE, SIZE, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .png()
    .toBuffer();
  const png = await sharp(square)
    .composite([{ input: roundedRectSvg("#ffffff"), blend: "dest-in" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  return { logo: { png, width: SIZE, height: SIZE, kind: "real" }, source: square };
}

/**
 * Logo déposé par le commerçant : TOUTE image est acceptée et normalisée en
 * badge 512×512 (logo détouré → badge contrasté ; logo sur fond uni →
 * recentré sur son fond ; photo / avatar → carré arrondi). Variante qui
 * renvoie aussi la source (palette). Lève `LogoReadError` si illisible.
 */
export async function logoFromUploadWithSource(image: UploadedImage): Promise<PreparedLogo> {
  const decoded = image?.buffer?.length ? await decodeImage(image.buffer, 2048) : null;
  if (!decoded) throw new LogoReadError();
  try {
    const result = await normalize(decoded, { strict: false });
    if (result) return { logo: result.logo, source: result.source };
  } catch (err) {
    console.warn("[essai/logo] logo déposé, normalisation de repli:", err instanceof Error ? err.message : err);
  }
  // Image unie, ou quasi transparente : on la montre telle quelle.
  return squareBadge(decoded.raster);
}

/** Logo déposé → badge 512×512 (voir `logoFromUploadWithSource`). */
export async function logoFromUpload(image: UploadedImage): Promise<BrandLogo> {
  return (await logoFromUploadWithSource(image)).logo;
}

// ─── Photo de profil (capture Instagram / Facebook) ───────────────────────

type Rgb = [number, number, number];

function pixel(r: Raster, x: number, y: number): Rgb {
  const i = (Math.min(r.height - 1, Math.max(0, y)) * r.width + Math.min(r.width - 1, Math.max(0, x))) * 4;
  return [r.data[i], r.data[i + 1], r.data[i + 2]];
}

/** Écart d'un pixel au fond de l'interface au-delà duquel il « fait partie » d'un élément. */
const UI_TOLERANCE = 28;
/** Zone de l'IA agrandie de 25 % de chaque côté : elle est souvent décalée. */
const AI_BOX_GROW = 0.25;
/** Recherche sans IA : tiers supérieur (un peu plus) de la capture. */
const AVATAR_SEARCH_HEIGHT = 0.42;
/** Largeur de travail de la recherche sans IA (vitesse). */
const AVATAR_SEARCH_WIDTH = 900;

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Disc {
  cx: number;
  cy: number;
  radius: number;
}

/** Couleur du fond de l'interface : mode des pixels du pourtour de la zone. */
function regionBackground(r: Raster, g: Region): Rgb {
  const bins = new Map<number, { n: number; sum: [number, number, number] }>();
  const add = (x: number, y: number) => {
    const p = pixel(r, x, y);
    const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
    const bin = bins.get(key) ?? { n: 0, sum: [0, 0, 0] };
    bin.n++;
    bin.sum[0] += p[0];
    bin.sum[1] += p[1];
    bin.sum[2] += p[2];
    bins.set(key, bin);
  };
  const x1 = g.left + g.width - 1;
  const y1 = g.top + g.height - 1;
  for (let x = g.left; x <= x1; x++) {
    add(x, g.top);
    add(x, y1);
  }
  for (let y = g.top + 1; y < y1; y++) {
    add(g.left, y);
    add(x1, y);
  }
  let best = { n: 0, sum: [255, 255, 255] as [number, number, number] };
  for (const bin of bins.values()) if (bin.n > best.n) best = bin;
  return best.n ? [best.sum[0] / best.n, best.sum[1] / best.n, best.sum[2] / best.n] : [255, 255, 255];
}

function differs(r: Raster, x: number, y: number, bg: Rgb): boolean {
  const i = (y * r.width + x) * 4;
  return (
    Math.abs(r.data[i] - bg[0]) > UI_TOLERANCE ||
    Math.abs(r.data[i + 1] - bg[1]) > UI_TOLERANCE ||
    Math.abs(r.data[i + 2] - bg[2]) > UI_TOLERANCE
  );
}

/**
 * Plus grand disque (photo de profil, anneau de story compris) de la zone :
 * composantes connexes des pixels « non-fond », quasi carrées, qui ne
 * touchent pas le bord de la zone, dont le pourtour circulaire est plein et
 * les coins de la boîte vides (un carré de publication n'est pas un disque).
 * `preferCenter` : départage par la proximité du centre de la zone.
 */
function findDisc(
  r: Raster,
  g: Region,
  opts: { minSide: number; preferCenter: boolean; minBackgroundShare?: number },
): Disc | null {
  const bg = regionBackground(r, g);
  const { width: W, height: H } = g;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (differs(r, g.left + x, g.top + y, bg)) mask[y * W + x] = 1;
  }
  // Interface d'appli : le fond uni domine. Une photo (ciel, mur…) n'en a pas.
  if (opts.minBackgroundShare) {
    let filled = 0;
    for (let i = 0; i < mask.length; i++) filled += mask[i];
    if (1 - filled / mask.length < opts.minBackgroundShare) return null;
  }
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;

  const labels = new Int32Array(W * H);
  const stack: number[] = [];
  let best: { disc: Disc; score: number } | null = null;
  let label = 0;
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || labels[start]) continue;
    label++;
    let minX = W;
    let minY = H;
    let maxX = -1;
    let maxY = -1;
    labels[start] = label;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % W;
      const y = (p - x) / W;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = label;
            stack.push(q);
          }
        }
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (Math.min(w, h) < opts.minSide || w / h < 0.85 || w / h > 1.18) continue;
    if (minX === 0 || minY === 0 || maxX === W - 1 || maxY === H - 1) continue;

    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const radius = (w + h) / 4;
    // Pourtour : à chaque angle, un pixel « non-fond » dans les 12 % extérieurs.
    let rim = 0;
    const ANGLES = 72;
    for (let a = 0; a < ANGLES; a++) {
      const t = (a / ANGLES) * Math.PI * 2;
      for (let k = 0; k <= 6; k++) {
        const rad = radius * (1 - 0.02 * k) - 0.5;
        if (at(Math.round(cx + rad * Math.cos(t)), Math.round(cy + rad * Math.sin(t)))) {
          rim++;
          break;
        }
      }
    }
    if (rim < ANGLES * 0.85) continue;
    // Coins de la boîte (hors du cercle) : vides pour un disque.
    let cornerHits = 0;
    let cornerSamples = 0;
    for (const base of [45, 135, 225, 315]) {
      for (const off of [-12, 0, 12]) {
        const t = ((base + off) * Math.PI) / 180;
        for (const f of [1.12, 1.2, 1.28]) {
          const x = Math.round(cx + radius * f * Math.cos(t));
          const y = Math.round(cy + radius * f * Math.sin(t));
          if (x < minX || x > maxX || y < minY || y > maxY) continue;
          cornerSamples++;
          if (at(x, y)) cornerHits++;
        }
      }
    }
    if (cornerSamples > 0 && cornerHits > cornerSamples * 0.25) continue;

    let score = radius;
    if (opts.preferCenter) {
      const d = Math.hypot(cx - W / 2, cy - H / 2) / Math.hypot(W / 2, H / 2);
      score *= 1 - 0.5 * d;
    }
    if (!best || score > best.score) best = { disc: { cx: g.left + cx, cy: g.top + cy, radius }, score };
  }
  return best?.disc ?? null;
}

/** Zone (px) autour d'une boîte relative, agrandie de `grow` de chaque côté. */
function grownRegion(r: Raster, box: Box, grow: number): Region | null {
  const mx = box.w * grow;
  const my = box.h * grow;
  const left = Math.max(0, Math.round((box.x - mx) * r.width));
  const top = Math.max(0, Math.round((box.y - my) * r.height));
  const right = Math.min(r.width, Math.round((box.x + box.w + mx) * r.width));
  const bottom = Math.min(r.height, Math.round((box.y + box.h + my) * r.height));
  if (right - left < 24 || bottom - top < 24) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Photo de profil SANS IA : plus grand disque non-fond du haut de la capture
 * (desktop : à gauche du pseudo ; mobile : en haut à gauche). Travaille sur
 * une copie réduite, renvoie une boîte relative (0..1) ou null. `strict` :
 * exige un fond d'interface uni dominant (classer une image inconnue sans
 * prendre une enseigne ronde sur une photo pour un avatar).
 */
async function searchAvatar(full: Raster, strict = false): Promise<Box | null> {
  const scale = Math.min(1, AVATAR_SEARCH_WIDTH / full.width);
  const small: Raster =
    scale < 1
      ? await (async () => {
          const { data, info } = await sharp(full.data, rawInput(full))
            .resize(Math.round(full.width * scale), Math.round(full.height * scale), { kernel: "linear" })
            .raw()
            .toBuffer({ resolveWithObject: true });
          return { data, width: info.width, height: info.height };
        })()
      : full;
  const region: Region = {
    left: 0,
    top: 0,
    width: small.width,
    height: Math.max(32, Math.round(small.height * AVATAR_SEARCH_HEIGHT)),
  };
  // Avatar : au moins ~5 % de la largeur sur desktop, bien plus sur mobile.
  const minSide = Math.max(24, Math.round(Math.min(small.width, small.height) * 0.06));
  const disc = findDisc(small, region, { minSide, preferCenter: false, minBackgroundShare: strict ? 0.35 : 0 });
  if (!disc) return null;
  const d = disc.radius * 2;
  return {
    x: (disc.cx - disc.radius) / small.width,
    y: (disc.cy - disc.radius) / small.height,
    w: d / small.width,
    h: d / small.height,
  };
}

/**
 * Rayon du disque intérieur (l'avatar lui-même) : on retire l'anneau de story
 * (coloré, ou gris s'il est vu) et le liseré clair qui le sépare de l'avatar.
 * Le long de 90 rayons, depuis le bord : un anneau fin (≤ 8 % du rayon), puis
 * du « fond », puis l'avatar. Profondeur retenue = 15e centile (les angles où
 * l'avatar a un bord clair, de la couleur du fond, donnent une valeur trop
 * grande) ; plafonnée, avec repli géométrique pour un avatar à fond blanc.
 */
function innerRadiusOf(r: Raster, disc: Disc, bg: Rgb): number {
  const { cx, cy, radius } = disc;
  const ANGLES = 90;
  const step = 0.5;
  const maxDepth = radius * 0.35;
  const ringRuns: number[] = [];
  const depths: number[] = [];
  let ringAngles = 0;
  const isBg = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= r.width || yi >= r.height) return true;
    return !differs(r, xi, yi, bg);
  };
  for (let a = 0; a < ANGLES; a++) {
    const t = (a / ANGLES) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let runStart = -1;
    let runEnd = -1;
    let inner = -1;
    for (let d = 0; d <= maxDepth; d += step) {
      const rad = radius + 0.5 - d;
      const bgHere = isBg(cx + rad * c, cy + rad * s);
      if (runStart < 0) {
        if (!bgHere) runStart = d;
        else if (d > radius * 0.06) break; // le bord du disque n'est pas ici
      } else if (runEnd < 0) {
        if (bgHere) runEnd = d;
      } else if (!bgHere) {
        inner = d;
        break;
      }
    }
    if (runStart < 0 || runEnd < 0) continue;
    const run = runEnd - runStart;
    if (run > 0 && run <= radius * 0.08) {
      ringAngles++;
      ringRuns.push(runEnd);
      if (inner > 0) depths.push(inner);
    }
  }
  // Pas d'anneau (pas de story, ou avatar plein jusqu'au bord) : disque entier.
  if (ringAngles < ANGLES * 0.65) return radius - 1;
  const quantile = (list: number[], q: number) => {
    const sorted = [...list].sort((x, y) => x - y);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];
  };
  const ringEnd = quantile(ringRuns, 0.5);
  let depth: number;
  if (depths.length >= ANGLES * 0.3 && quantile(depths, 0.15) <= radius * 0.22) {
    depth = quantile(depths, 0.15);
  } else {
    // Avatar à fond clair (de la couleur du fond) : anneau + liseré ≈ 2,2 × l'anneau.
    depth = Math.min(radius * 0.14, ringEnd * 2.2);
  }
  return radius - depth - 1.5;
}

/**
 * Photo de profil ronde d'une capture Instagram / Facebook → badge propre,
 * sans un pixel de l'interface autour :
 *  1. zone de l'IA agrandie de 25 % (souvent décalée) — ou, sans IA, recherche
 *     du plus grand disque dans le haut de la capture ;
 *  2. disque isolé par les pixels « non-fond » (fond de l'interface mesuré
 *     sur le pourtour : mode clair ET sombre) ;
 *  3. anneau de story et liseré retirés (disque intérieur) ;
 *  4. masque rond parfaitement centré (précision sous-pixel), 512 px, léger
 *     renforcement de netteté (l'avatar fait souvent ~150 px) ;
 *  5. badge = le disque rond détouré (coins transparents).
 * `box` null : détection sans IA. null si aucun disque n'est trouvé.
 */
export async function logoFromAvatar(
  image: Buffer,
  box: { x: number; y: number; w: number; h: number } | null,
): Promise<PreparedLogo | null> {
  try {
    const validBox =
      box && [box.x, box.y, box.w, box.h].every((v) => Number.isFinite(v)) && box.w > 0 && box.h > 0 ? box : null;
    const decoded = await decodeImage(image, 2400);
    if (!decoded) return null;
    const full = decoded.raster;

    // 1-2. Disque complet (anneau compris).
    let disc: Disc | null = null;
    let region: Region | null = null;
    if (validBox) {
      region = grownRegion(full, validBox, AI_BOX_GROW);
      if (region) {
        const minSide = Math.max(16, Math.round(Math.min(region.width, region.height) * 0.3));
        disc = findDisc(full, region, { minSide, preferCenter: true });
      }
    }
    if (!disc) {
      const found = await searchAvatar(full);
      if (found) {
        region = grownRegion(full, found, 0.15);
        if (region) {
          const minSide = Math.max(16, Math.round(Math.min(region.width, region.height) * 0.5));
          disc = findDisc(full, region, { minSide, preferCenter: true });
        }
      }
    }
    if (!disc && validBox) {
      // Dernier recours : le cercle inscrit dans la zone de l'IA.
      const px = { x: validBox.x * full.width, y: validBox.y * full.height, w: validBox.w * full.width, h: validBox.h * full.height };
      disc = { cx: px.x + px.w / 2, cy: px.y + px.h / 2, radius: (Math.min(px.w, px.h) / 2) * 0.92 };
    }
    if (!disc || disc.radius < 12) return null;

    // 3. Disque intérieur (sans anneau de story ni liseré).
    const bg = region ? regionBackground(full, region) : pixel(full, 0, 0);
    const inner = innerRadiusOf(full, disc, bg);
    if (inner < 10) return null;

    // 4. Recadrage sous-pixel : zone entière autour du centre, mise à
    //    l'échelle, puis extraction du carré exactement centré.
    const half = Math.ceil(inner) + 2;
    const left = Math.max(0, Math.floor(disc.cx) - half);
    const top = Math.max(0, Math.floor(disc.cy) - half);
    const right = Math.min(full.width, Math.floor(disc.cx) + half + 1);
    const bottom = Math.min(full.height, Math.floor(disc.cy) + half + 1);
    const scale = SIZE / (2 * inner);
    const scaledW = Math.max(SIZE, Math.round((right - left) * scale));
    const scaledH = Math.max(SIZE, Math.round((bottom - top) * scale));
    const offX = Math.max(0, Math.min(scaledW - SIZE, Math.round((disc.cx - inner - left) * scale)));
    const offY = Math.max(0, Math.min(scaledH - SIZE, Math.round((disc.cy - inner - top) * scale)));
    let pipeline = sharp(full.data, rawInput(full))
      .extract({ left, top, width: right - left, height: bottom - top })
      .resize(scaledW, scaledH, { fit: "fill", kernel: "lanczos3" });
    // Avatar agrandi (souvent ×3) : léger renforcement des contours.
    if (scale > 1.5) pipeline = pipeline.sharpen({ sigma: Math.min(1.2, 0.5 + scale * 0.15) });
    const disc512 = await sharp(await pipeline.png().toBuffer())
      .extract({ left: offX, top: offY, width: SIZE, height: SIZE })
      .png()
      .toBuffer();
    const circleMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`,
    );
    const source = await sharp(disc512).composite([{ input: circleMask, blend: "dest-in" }]).png().toBuffer();

    // 5. Badge final : le disque lui-même, coins transparents (rendu identique
    //    à l'avatar ; Google Wallet affiche de toute façon le logo en rond). Une
    //    tuile de la couleur du bord laissait voir un liseré au raccord.
    const png = await sharp(source).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    return { logo: { png, width: SIZE, height: SIZE, kind: "real" }, source };
  } catch (err) {
    console.warn("[essai/logo] photo de profil inexploitable:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * La capture contient-elle une photo de profil ronde (recherche sans IA) ?
 * Sert à classer une image « auto » quand l'IA n'a pas répondu.
 */
export async function hasProfileAvatar(image: Buffer): Promise<boolean> {
  try {
    const decoded = await decodeImage(image, 1600);
    return decoded ? (await searchAvatar(decoded.raster, true)) !== null : false;
  } catch {
    return false;
  }
}

// ─── Favicon via Google (sites qui bloquent les robots) ───────────────────

/**
 * Icône du site servie par le service public de Google (il la met en cache
 * de son côté, même quand le site nous refuse en 403). Si Google n'a rien,
 * il répond 404 avec un globe générique 16 px : rejeté par logo.ts (erreur
 * HTTP, puis taille minimale de 48 px).
 */
export function googleFaviconCandidate(hostname: string): LogoCandidate | null {
  const host = (hostname ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return null;
  return {
    url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`,
    kind: "favicon",
    size: 256,
  };
}

// ─── Logo typographique ───────────────────────────────────────────────────

/** Mots ignorés pour les initiales (« Chez Paul » → « P »). */
const STOP_WORDS = new Set([
  "le", "la", "les", "l", "chez", "the", "de", "du", "des", "d", "et", "and",
  "au", "aux", "a", "à", "un", "une", "en", "by", "of",
]);

/** 1 à 2 initiales en capitales (lettres latines, accents et chiffres inclus). */
export function initialsOf(name: string): string {
  const words = name
    .normalize("NFC")
    .split(/[^A-Za-z0-9À-ɏ]+/)
    .filter(Boolean);
  const significant = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : words;
  return pool
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toLocaleUpperCase("fr-FR");
}

/**
 * Couleurs du logo typographique : initiales couleur du FOND de la carte sur
 * un badge couleur ACCENT ; si l'accent ne contraste pas assez avec ces
 * initiales (< 3:1, seuil WCAG des grands textes), badge blanc, sinon sombre.
 */
function typographicColors(colors: BrandColors): { badge: string; ink: string } {
  const ink = isHexColor(colors.background) ? colors.background : BADGE_DARK;
  const options = [colors.accent, BADGE_LIGHT, BADGE_DARK].filter(isHexColor);
  const readable = options.find((c) => contrastRatio(c, ink) >= 3);
  if (readable) return { badge: readable, ink };
  // Fond de carte de luminance moyenne : aucun badge ne fait ressortir
  // l'encre « fond » → on garde l'accent et on écrit en blanc ou noir.
  const badge = options[0];
  return {
    badge,
    ink: contrastRatio(badge, BADGE_LIGHT) >= contrastRatio(badge, BADGE_DARK) ? BADGE_LIGHT : BADGE_DARK,
  };
}

/**
 * Logo de secours : initiales en gras sur badge arrondi, 512×512.
 *
 * Rendu via `ImageResponse` (next/og, Satori + Resvg) avec la police
 * embarquée par next/og : Vercel n'a AUCUNE police système, donc un `<text>`
 * SVG rendu par sharp sortirait vide. La police par défaut n'existe qu'en
 * graisse normale : on l'épaissit avec un contour de la même couleur.
 * Filet de sécurité si Satori échoue : badge + étoile en tracé SVG (aucune
 * police nécessaire).
 */
export async function typographicLogo(name: string, colors: BrandColors): Promise<BrandLogo> {
  const { badge, ink } = typographicColors(colors);
  const initials = initialsOf(name);

  if (initials) {
    try {
      const fontSize = initials.length === 1 ? 300 : 228;
      const element = createElement(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
        },
        createElement(
          "div",
          {
            style: {
              width: SIZE,
              height: SIZE,
              borderRadius: RADIUS,
              backgroundColor: badge,
              color: ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize,
              lineHeight: 1,
              letterSpacing: initials.length > 1 ? -Math.round(fontSize * 0.02) : 0,
              WebkitTextStroke: `${Math.round(fontSize * 0.045)}px ${ink}`,
              // Les capitales sont optiquement basses avec lineHeight 1 :
              // léger rehaussement pour un centrage visuel.
              paddingBottom: Math.round(fontSize * 0.06),
            },
          },
          initials,
        ),
      );
      const res = new ImageResponse(element, { width: SIZE, height: SIZE });
      const png = Buffer.from(await res.arrayBuffer());
      if (isPng(png)) return { png, width: SIZE, height: SIZE, kind: "typographic" };
    } catch (err) {
      console.warn("[essai/logo] rendu des initiales impossible:", err instanceof Error ? err.message : err);
    }
  }

  // Secours sans police : étoile (même tracé que les tampons) sur le badge.
  const star = getIconPath("star");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="${badge}"/>` +
    `<g transform="translate(${SIZE * 0.2} ${SIZE * 0.2}) scale(${(SIZE * 0.6) / 24})"><path d="${star}" fill="${ink}"/></g></svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return { png, width: SIZE, height: SIZE, kind: "typographic" };
}
