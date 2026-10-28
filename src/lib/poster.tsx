import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import {
  Circle,
  Defs,
  Document,
  Image,
  Line,
  Page,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Affiche comptoir A4 (PDF) « Scannez pour recevoir votre carte de
 * fidélité », entièrement aux couleurs du commerce : photo en grand visuel,
 * vrai logo, nom en très grand, offre mise en scène dans un « ticket »,
 * grand QR code vectoriel.
 *
 * Partagée entre :
 *  - /api/onboarding/poster/[cardId] (commerçant connecté, sa carte) ;
 *  - /api/essai/[token]/poster (démo « Votre carte en 30 secondes »).
 *
 * Garanties :
 *  - TOUJOURS une seule page A4 : tout est positionné à des hauteurs
 *    maîtrisées et chaque texte variable (nom, offre) est mesuré avec les
 *    métriques Helvetica puis réduit / tronqué proprement s'il est trop long ;
 *  - les images distantes (photo, logo) sont récupérées côté serveur,
 *    normalisées par sharp (SVG → PNG, HEIC/WebP → JPEG/PNG) et passées en
 *    data URI. Si une image manque ou échoue, la mise en page de repli
 *    (aplat + motif discret) reste soignée.
 *
 * Rendu côté serveur uniquement (Node : sharp, fs, @react-pdf/renderer).
 */

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

export interface PosterProps {
  businessName: string;
  cardName: string;
  rewardText: string;
  /**
   * URL encodée dans le QR code : il est alors dessiné en VECTORIEL (net à
   * toutes les tailles d'impression). Préféré à {@link qrDataUrl}.
   */
  qrValue?: string | null;
  /** QR code déjà rendu en data URL (cf. {@link posterQrDataUrl}) — repli. */
  qrDataUrl?: string | null;
  /** Couleur d'accent de la carte (#rrggbb) : ticket de l'offre, puces. */
  accentColor: string;
  /** Fond de la carte (#rrggbb) : fond de l'affiche. */
  backgroundColor?: string | null;
  /** Couleur de texte de la carte (#rrggbb) — corrigée si illisible. */
  textColor?: string | null;
  /** Logo (http(s), chemin /public ou data URI). Jamais d'initiales à la place. */
  logoUrl?: string | null;
  /** Photo du commerce (design.banner_url) affichée en grand visuel. */
  photoUrl?: string | null;
  /** Base pour résoudre les chemins relatifs (/template-assets/…). */
  appUrl?: string | null;
}

/** Génère le PDF de l'affiche (une seule page A4). */
export async function renderPosterPdf(props: PosterProps): Promise<Buffer> {
  const theme = buildTheme(props.backgroundColor, props.textColor, props.accentColor);
  const businessName = pdfSafeText(props.businessName) || "Votre commerce";
  const rewardText = pdfSafeText(props.rewardText) || "Des avantages à chaque passage";

  // Récupération des images en parallèle ; un échec n'empêche jamais le rendu.
  const [photoBytes, logoBytes] = await Promise.all([
    loadImageBytes(props.photoUrl, props.appUrl),
    loadImageBytes(props.logoUrl, props.appUrl),
  ]);

  const layout = computeLayout({ businessName, rewardText, hasPhoto: Boolean(photoBytes) });

  const [photo, logo] = await Promise.all([
    photoBytes ? preparePhoto(photoBytes, theme, layout).catch(logImageError("photo")) : null,
    logoBytes ? prepareLogo(logoBytes, theme).catch(logImageError("logo")) : null,
  ]);

  // Si la photo n'a pas pu être décodée, on recalcule la mise en page « sans photo ».
  const finalLayout = photo || !photoBytes ? layout : computeLayout({ businessName, rewardText, hasPhoto: false });

  const qr = props.qrValue ? qrVector(props.qrValue) : null;
  if (!qr && !props.qrDataUrl) {
    throw new Error("[poster] qrValue ou qrDataUrl requis");
  }

  return renderToBuffer(
    PosterDocument({
      theme,
      layout: finalLayout,
      businessName,
      photo: photo ?? null,
      logo: logo ?? null,
      qr,
      qrDataUrl: props.qrDataUrl ?? null,
    })
  );
}

/** QR code de l'affiche en PNG (repli si l'on ne peut pas passer `qrValue`). */
export function posterQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 1000,
    margin: 0,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Les polices PDF standard (Helvetica, encodage WinAnsi) ne savent pas
 * dessiner les emoji ni certains signes typographiques : on les remplace
 * par leur équivalent sûr plutôt que d'imprimer des glyphes cassés.
 */
export function pdfSafeText(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/[−‐‑]/g, "-") // signe moins, traits d'union insécables
    .replace(/[    ]/g, " ") // espaces fines / insécables étroites
    .replace(/[​-‍️]/g, "") // caractères invisibles (ZWJ, sélecteurs emoji)
    .replace(
      /[^\u0009\u000A\u000D -~ -ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs
// ─────────────────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function normalizeHex(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  const long = /^#?([0-9a-f]{6})$/i.exec(s);
  if (long) return `#${long[1].toLowerCase()}`;
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return null;
}

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
function relLum(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mélange `a` → `b` (t = 0 : a ; t = 1 : b). */
function mix(a: string, b: string, t: number): string {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex([0, 1, 2].map((i) => ra[i] + (rb[i] - ra[i]) * t) as Rgb);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Theme {
  /** Fond de page. */
  bg: string;
  /** Texte principal, lisible sur `bg`. */
  text: string;
  /** Accent pour traits fins et filets : lisible sur `bg`. */
  accent: string;
  /** Accent pour les aplats (pastilles, tampons, ticket de l'offre). */
  accentFill: string;
  /** Encre posée sur `accentFill`. */
  accentInk: string;
  /** Fond sombre ? (choix des overlays). */
  dark: boolean;
}

function bestInk(fill: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrast(fill, c) > contrast(fill, best) ? c : best));
}

function rgbDistance(a: string, b: string): number {
  const [ra, rb] = [toRgb(a), toRgb(b)];
  return Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]);
}

function buildTheme(bgIn?: string | null, textIn?: string | null, accentIn?: string | null): Theme {
  const accentRaw = normalizeHex(accentIn);
  const bg = normalizeHex(bgIn) ?? (accentRaw ? mix(accentRaw, "#000000", 0.78) : "#151515");
  const dark = relLum(bg) < 0.2;

  // Neutres « teintés » du fond (plus élégants qu'un noir / blanc purs).
  const lightInk = mix(bg, "#ffffff", 0.95);
  const darkInk = mix(bg, "#000000", 0.86);
  const neutralInk = bestInk(bg, [lightInk, darkInk]);

  const textRaw = normalizeHex(textIn);
  const text = textRaw && contrast(textRaw, bg) >= 4 ? textRaw : neutralInk;

  // Traits : l'accent assombri (fond clair) ou éclairci (fond sombre) jusqu'à
  // être lisible — on garde sa teinte plutôt que de basculer sur le texte.
  const accentBase = accentRaw ?? text;
  const towards = contrast(bg, "#ffffff") > contrast(bg, "#000000") ? "#ffffff" : "#000000";
  let accent = accentBase;
  for (const t of [0, 0.2, 0.35, 0.5, 0.65, 0.8]) {
    accent = mix(accentBase, towards, t);
    if (contrast(accent, bg) >= 2.6) break;
  }
  if (contrast(accent, bg) < 2.6) accent = text;

  // Aplats : un jaune pâle sur blanc se voit très bien (teinte) malgré un
  // faible contraste de luminance → on le garde, avec une encre adaptée.
  const fillVisible = (c: string) => contrast(c, bg) >= 1.5 || rgbDistance(c, bg) >= 110;
  const accentFill = accentRaw && fillVisible(accentRaw) ? accentRaw : fillVisible(accent) ? accent : text;
  const accentInk = contrast(accentFill, bg) >= 3.2 ? bg : bestInk(accentFill, ["#ffffff", "#141414"]);

  return { bg, text, accent, accentFill, accentInk, dark };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesure du texte (métriques AFM Helvetica, en 1/1000 em)
// ─────────────────────────────────────────────────────────────────────────────

// Largeurs des caractères 32..255 (WinAnsi), extraites des AFM Adobe.
const HELVETICA_W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,556,556,556,556,260,556,333,737,370,556,584,0,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const HELVETICA_BOLD_W = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,556,556,556,556,280,556,333,737,370,556,584,0,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];
// Caractères WinAnsi hors Latin-1 (guillemets, tirets, €, œ…).
const EXTRA_W: Record<number, [number, number]> = {
  0x152: [1000, 1000], 0x153: [944, 944], 0x160: [667, 667], 0x161: [500, 556],
  0x178: [667, 667], 0x17d: [611, 611], 0x17e: [500, 500], 0x192: [556, 556],
  0x2c6: [333, 333], 0x2dc: [333, 333], 0x2013: [556, 556], 0x2014: [1000, 1000],
  0x2018: [222, 278], 0x2019: [222, 278], 0x201a: [222, 278], 0x201c: [333, 500],
  0x201d: [333, 500], 0x201e: [333, 500], 0x2020: [556, 556], 0x2021: [556, 556],
  0x2022: [350, 350], 0x2026: [1000, 1000], 0x2030: [1000, 1000], 0x2039: [333, 333],
  0x203a: [333, 333], 0x20ac: [556, 556], 0x2122: [1000, 1000],
};

/** Marge de sécurité sur les mesures (crénage, arrondis). */
const MEASURE_SAFETY = 1.03;

function textWidth(text: string, size: number, bold: boolean, tracking = 0): number {
  const table = bold ? HELVETICA_BOLD_W : HELVETICA_W;
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 32;
    if (code >= 32 && code <= 255) units += table[code - 32] || 556;
    else units += EXTRA_W[code]?.[bold ? 1 : 0] ?? 600;
  }
  return ((units * size) / 1000 + tracking * [...text].length) * MEASURE_SAFETY;
}

interface FitOptions {
  maxWidth: number;
  /** Taille max autorisée selon le nombre de lignes (index 0 = 1 ligne). */
  maxSizes: number[];
  minSize: number;
  bold: boolean;
  lineHeight: number;
  maxHeight: number;
  /** Interlettrage en em (ex. -0.02). */
  tracking?: number;
}

interface FittedText {
  size: number;
  lines: string[];
  tracking: number;
}

function greedyWrap(words: string[], fits: (s: string) => boolean): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || fits(candidate)) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Répartit les mots sur `k` lignes en minimisant la ligne la plus longue. */
function balancedWrap(words: string[], k: number, width: (s: string) => number, maxWidth: number): string[] | null {
  const n = words.length;
  if (k <= 1 || n <= 1) return null;
  const seg = (i: number, j: number) => width(words.slice(i, j).join(" "));
  // best[l][j] : coût min (largeur de la plus longue ligne) pour j mots sur l lignes.
  const best: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity));
  const prev: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(-1));
  best[0][0] = 0;
  for (let l = 1; l <= k; l++) {
    for (let j = 1; j <= n; j++) {
      for (let i = l - 1; i < j; i++) {
        if (best[l - 1][i] === Infinity) continue;
        const w = seg(i, j);
        if (w > maxWidth) continue;
        const cost = Math.max(best[l - 1][i], w);
        if (cost < best[l][j]) {
          best[l][j] = cost;
          prev[l][j] = i;
        }
      }
    }
  }
  if (best[k][n] === Infinity) return null;
  const lines: string[] = [];
  let j = n;
  for (let l = k; l >= 1; l--) {
    const i = prev[l][j];
    lines.unshift(words.slice(i, j).join(" "));
    j = i;
  }
  return lines;
}

function ellipsize(line: string, fits: (s: string) => boolean): string {
  let s = line;
  while (s.length > 1 && !fits(`${s}…`)) s = s.slice(0, -1).trimEnd();
  return `${s.replace(/[\s,.;:–-]+$/, "")}…`;
}

/**
 * Choisit la plus grande taille de police pour laquelle le texte tient dans
 * la boîte, avec des lignes équilibrées. En dernier recours (taille mini),
 * coupe les mots trop longs et tronque avec « … ».
 */
function fitText(raw: string, o: FitOptions): FittedText {
  const words = raw.split(/\s+/).filter(Boolean);
  const trackingEm = o.tracking ?? 0;
  const maxLines = o.maxSizes.length;

  for (let size = Math.max(...o.maxSizes); size >= o.minSize; size -= 0.5) {
    const tracking = trackingEm * size;
    const width = (s: string) => textWidth(s, size, o.bold, tracking);
    const fits = (s: string) => width(s) <= o.maxWidth;
    if (!words.every(fits)) continue;
    const greedy = greedyWrap(words, fits);
    const count = greedy.length;
    if (count > maxLines || size > o.maxSizes[count - 1]) continue;
    if (count * size * o.lineHeight > o.maxHeight) continue;
    return { size, lines: balancedWrap(words, count, width, o.maxWidth) ?? greedy, tracking };
  }

  // Repli : taille mini, mots coupés au caractère, dernière ligne tronquée.
  const size = o.minSize;
  const tracking = trackingEm * size;
  const fits = (s: string) => textWidth(s, size, o.bold, tracking) <= o.maxWidth;
  const pieces: string[] = [];
  for (const word of words) {
    let rest = word;
    while (!fits(rest)) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(`${rest.slice(0, cut)}-`)) cut--;
      pieces.push(`${rest.slice(0, cut)}-`);
      rest = rest.slice(cut);
    }
    pieces.push(rest);
  }
  const allowed = Math.max(1, Math.min(maxLines, Math.floor(o.maxHeight / (size * o.lineHeight))));
  const lines = greedyWrap(pieces, fits);
  if (lines.length <= allowed) return { size, lines, tracking };
  const kept = lines.slice(0, allowed);
  kept[allowed - 1] = ellipsize(kept[allowed - 1], fits);
  return { size, lines: kept, tracking };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mise en page (A4 = 595,28 × 841,89 pt) — toutes les hauteurs sont fixes
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const FOOTER_TOP = PAGE_H - 30;

const CARD_W = 232;
const QR_PAD = 22; // zone de silence ≥ 4 modules
const QR_SIZE = CARD_W - 2 * QR_PAD;
const PILL_H = 26;
const CARD_H = QR_PAD + QR_SIZE + 12 + PILL_H + 16;
const CARD_TOP = FOOTER_TOP - 20 - CARD_H;
const CARD_LEFT = PAGE_W - MARGIN - CARD_W;

const LEFT_W = CONTENT_W - CARD_W - 26;

const TICKET_H = 124;
const TICKET_TOP = CARD_TOP - 24 - TICKET_H;
const STUB_W = 92;
const TICKET_PAD_X = 24;

const TITLE_BOTTOM = TICKET_TOP - 22;
const EYEBROW_H = 24;

const MASTHEAD_TOP = 32;

interface Layout {
  hasPhoto: boolean;
  heroH: number;
  name: FittedText;
  nameTop: number;
  offer: FittedText;
  cta: FittedText;
  logoH: number;
}

function computeLayout({
  businessName,
  rewardText,
  hasPhoto,
}: {
  businessName: string;
  rewardText: string;
  hasPhoto: boolean;
}): Layout {
  const name = fitText(businessName, {
    maxWidth: CONTENT_W,
    maxSizes: [66, 48],
    minSize: 26,
    bold: true,
    lineHeight: 1.02,
    maxHeight: 2 * 48 * 1.02,
    tracking: -0.025,
  });
  const nameH = name.lines.length * name.size * 1.02;
  const nameTop = TITLE_BOTTOM - nameH - EYEBROW_H;

  const offer = fitText(rewardText, {
    maxWidth: CONTENT_W - STUB_W - 2 * TICKET_PAD_X,
    maxSizes: [34, 30, 21],
    minSize: 13,
    bold: true,
    lineHeight: 1.1,
    maxHeight: TICKET_H - 2 * 20 - 20,
    tracking: -0.01,
  });

  const cta = fitText("Scannez pour recevoir votre carte de fidélité", {
    maxWidth: LEFT_W,
    maxSizes: [24, 24, 27],
    minSize: 16,
    bold: true,
    lineHeight: 1.08,
    maxHeight: 3 * 27 * 1.08,
    tracking: -0.015,
  });

  return {
    hasPhoto,
    heroH: TICKET_TOP + TICKET_H / 2,
    name,
    nameTop,
    offer,
    cta,
    logoH: hasPhoto ? 66 : 78,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Images : récupération + normalisation (sharp)
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function logImageError(kind: string) {
  return (err: unknown) => {
    console.warn(`[poster] ${kind} ignoré :`, err instanceof Error ? err.message : err);
    return null;
  };
}

/** Hôtes internes refusés en production (SSRF). */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) {
    return true;
  }
  if (h.includes(":")) return true; // IPv6 littérale
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** http(s) uniquement ; en production : https et hôte public seulement. */
function isFetchableUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return url.protocol === "https:" && !isPrivateHost(url.hostname);
}

/**
 * Octets d'une image : data URI, fichier de /public (chemin relatif) ou
 * URL http(s). `null` en cas d'échec (jamais d'exception).
 */
async function loadImageBytes(src: string | null | undefined, appUrl?: string | null): Promise<Buffer | null> {
  const s = (src ?? "").trim();
  if (!s) return null;
  try {
    if (s.startsWith("data:")) {
      const m = /^data:[^,]*?(;base64)?,([\s\S]*)$/.exec(s);
      if (!m) return null;
      return m[1] ? Buffer.from(m[2], "base64") : Buffer.from(decodeURIComponent(m[2]), "utf8");
    }

    let url: URL;
    if (s.startsWith("/") && !s.startsWith("//")) {
      // Fichier statique de l'app (ex. /template-assets/logo.svg).
      const publicDir = path.join(process.cwd(), "public");
      const file = path.resolve(publicDir, `.${decodeURIComponent(s.split(/[?#]/)[0])}`);
      if (file.startsWith(publicDir + path.sep)) {
        try {
          return await readFile(file);
        } catch {
          // Absent du bundle serverless : on tente l'URL publique de l'app.
        }
      }
      if (!appUrl) return null;
      url = new URL(s, appUrl);
    } else {
      url = new URL(s);
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      // Redirections suivies à la main pour revalider chaque destination.
      let res: Response | null = null;
      for (let hop = 0; hop < 4; hop++) {
        if (!isFetchableUrl(url)) return null;
        res = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
        const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
        if (!location) break;
        url = new URL(location, url);
        res = null;
      }
      if (!res || !res.ok) return null;
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_IMAGE_BYTES) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > 0 && buf.length <= MAX_IMAGE_BYTES ? buf : null;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn("[poster] image inaccessible :", err instanceof Error ? err.message : err);
    return null;
  }
}

function isSvg(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 512).toString("utf8").trimStart();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")) || head.includes("<svg");
}

function openImage(bytes: Buffer) {
  return sharp(bytes, {
    failOn: "none",
    limitInputPixels: 80_000_000,
    ...(isSvg(bytes) ? { density: 300 } : {}),
  }).rotate();
}

/** Résolution de rendu des images (≈ 175 dpi sur l'A4). */
const PX_PER_PT = 2.4;

/**
 * Photo plein cadre + fondu vers la couleur de fond (le nom du commerce se
 * pose dessus) + léger voile en haut (lisibilité de l'en-tête). Le fondu est
 * « cuit » dans le JPEG : rendu identique dans tous les lecteurs PDF.
 */
async function preparePhoto(bytes: Buffer, theme: Theme, layout: Layout): Promise<string | null> {
  const w = Math.round(PAGE_W * PX_PER_PT);
  const h = Math.round(layout.heroH * PX_PER_PT);
  const solidY = layout.nameTop + (theme.dark ? 30 : 8);
  const at = (y: number) => Math.max(0, Math.min(1, y / layout.heroH));
  const [r, g, b] = toRgb(theme.bg);
  const stop = (y: number, a: number) =>
    `<stop offset="${at(y).toFixed(4)}" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>`;
  const solidAlpha = theme.dark ? 0.8 : 0.9;

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="${theme.dark ? 0.42 : 0.26}"/>
      <stop offset="${at(150).toFixed(4)}" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      ${stop(solidY - 190, 0)}
      ${stop(solidY - 125, 0.16)}
      ${stop(solidY - 62, 0.46)}
      ${stop(solidY, solidAlpha)}
      ${stop(solidY + 46, 0.97)}
      ${stop(TICKET_TOP - 6, 1)}
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#top)"/>
  <rect width="${w}" height="${h}" fill="url(#fade)"/>
</svg>`;

  const resized = await openImage(bytes)
    .resize(w, h, { fit: "cover", position: sharp.strategy.attention })
    .flatten({ background: theme.bg })
    .modulate({ saturation: 1.06 })
    .toColorspace("srgb")
    .png()
    .toBuffer();

  const out = await sharp(resized)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

interface LogoAsset {
  src: string;
  /** largeur / hauteur du visuel final. */
  aspect: number;
}

function roundedMask(w: number, h: number, radius: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );
}

/**
 * Logo prêt à poser : PNG à coins arrondis, toujours lisible.
 *  - logo « badge » (carré plein, coins éventuellement transparents) : tel quel ;
 *  - logo opaque (fond uni) : tuile arrondie de la couleur de son fond ;
 *  - logo détouré : tuile blanche (logo sombre) ou sombre (logo clair).
 */
async function prepareLogo(bytes: Buffer, theme: Theme): Promise<LogoAsset | null> {
  const { data, info } = await openImage(bytes)
    .resize(640, 640, { fit: "inside", withoutEnlargement: !isSvg(bytes) })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (!w || !h) return null;

  let alphaSum = 0;
  let lumSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    alphaSum += a;
    lumSum += a * ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
  }
  const coverage = alphaSum / (w * h);
  if (coverage < 0.01) return null; // image vide
  const meanLum = lumSum / Math.max(alphaSum, 1);

  const px = (x: number, y: number) => {
    const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const corners = [px(2, 2), px(w - 3, 2), px(2, h - 3), px(w - 3, h - 3)];
  const cornerAlpha = corners.reduce((s, c) => s + c[3], 0) / (4 * 255);
  const cornerColor = toHex([0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / 4) as Rgb);
  const aspect = w / h;
  const raw = sharp(data, { raw: { width: w, height: h, channels: 4 } });
  const toUri = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;

  // 1. Badge carré « plein » (ex. carré arrondi) : on le garde tel quel.
  if (coverage >= 0.82 && cornerAlpha < 0.9 && aspect > 0.8 && aspect < 1.25) {
    return { src: toUri(await raw.png().toBuffer()), aspect };
  }

  const tileH = 360;
  // 2. Logo opaque presque carré : plein cadre, coins arrondis.
  if (cornerAlpha >= 0.9 && aspect > 0.85 && aspect < 1.18) {
    const out = await raw
      .resize(tileH, tileH, { fit: "cover" })
      .composite([{ input: roundedMask(tileH, tileH, tileH * 0.22), blend: "dest-in" }])
      .png()
      .toBuffer();
    return { src: toUri(out), aspect: 1 };
  }

  // 3. Tuile : couleur du fond du logo (opaque) ou contrastée (détouré).
  let content = raw;
  let contentAspect = aspect;
  let tile: string;
  let pad: number;
  if (cornerAlpha >= 0.9) {
    tile = cornerColor;
    pad = 0.1;
  } else {
    // Détouré : on retire les marges transparentes pour un logo bien cadré.
    const trimmed = await raw
      .png()
      .toBuffer()
      .then((png) => sharp(png).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true }))
      .catch(() => null);
    if (trimmed && trimmed.info.width > 4 && trimmed.info.height > 4) {
      content = sharp(trimmed.data);
      contentAspect = trimmed.info.width / trimmed.info.height;
    }
    const darkTile = theme.dark ? mix(theme.bg, "#000000", 0.2) : "#161616";
    tile = meanLum < 0.62 ? "#ffffff" : darkTile;
    pad = 0.16;
  }

  const tileAspect = Math.max(1, Math.min(2.6, contentAspect * 0.92));
  const tileW = Math.round(tileH * tileAspect);
  const padPx = Math.round(tileH * pad);
  const inner = await content
    .resize(tileW - 2 * padPx, tileH - 2 * padPx, { fit: "inside" })
    .png()
    .toBuffer();
  const out = await sharp({
    create: { width: tileW, height: tileH, channels: 4, background: tile },
  })
    .composite([
      { input: inner, gravity: "centre" },
      { input: roundedMask(tileW, tileH, tileH * 0.22), blend: "dest-in" },
    ])
    .png()
    .toBuffer();
  return { src: toUri(out), aspect: tileW / tileH };
}

// ─────────────────────────────────────────────────────────────────────────────
// QR code vectoriel
// ─────────────────────────────────────────────────────────────────────────────

interface QrVector {
  size: number;
  d: string;
}

function qrVector(value: string): QrVector {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "H" });
  const n = modules.size;
  const parts: string[] = [];
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      if (!modules.get(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < n && modules.get(row, col)) col++;
      // Léger recouvrement vertical : pas de liseré blanc entre les rangées.
      parts.push(`M${start} ${row}h${col - start}v1.04h${start - col}z`);
    }
  }
  return { size: n, d: parts.join("") };
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  "Scannez le QR code avec votre téléphone",
  "Ajoutez la carte à votre Wallet",
  "Cumulez vos avantages à chaque passage",
];

/** Pas de césure automatique : nos lignes sont déjà calculées. */
const noHyphenation = (word: string) => [word];

interface PosterModel {
  theme: Theme;
  layout: Layout;
  businessName: string;
  photo: string | null;
  logo: LogoAsset | null;
  qr: QrVector | null;
  qrDataUrl: string | null;
}

function ticketPath(w: number, h: number, notchX: number): string {
  const r = 18;
  const n = 11;
  return [
    `M${r} 0`,
    `H${notchX - n}`,
    `A${n} ${n} 0 0 0 ${notchX + n} 0`,
    `H${w - r}`,
    `A${r} ${r} 0 0 1 ${w} ${r}`,
    `V${h - r}`,
    `A${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H${notchX + n}`,
    `A${n} ${n} 0 0 0 ${notchX - n} ${h}`,
    `H${r}`,
    `A${r} ${r} 0 0 1 0 ${h - r}`,
    `V${r}`,
    `A${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

/** Icône « cadeau » (tracé Lucide, licence ISC). */
function GiftIcon({ size, color }: { size: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={8} width={18} height={4} rx={1} {...stroke} />
      <Path d="M12 8v13" {...stroke} />
      <Path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" {...stroke} />
      <Path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" {...stroke} />
    </Svg>
  );
}

/** Pictogramme générique « cartes empilées » (pas de logo déposé). */
function WalletGlyph({ colors }: { colors: string[] }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Rect x={0} y={0} width={14} height={14} rx={3.4} fill="#2a2a2c" />
      {colors.map((c, i) => (
        <Rect key={c} x={2.4} y={2.6 + i * 1.9} width={9.2} height={3.4} rx={1} fill={c} />
      ))}
      <Rect x={2.4} y={8.6} width={9.2} height={3} rx={0.8} fill="#2a2a2c" />
    </Svg>
  );
}

function WalletPill({ label, colors }: { label: string; colors: string[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#0b0b0c",
        borderRadius: 7,
        height: PILL_H,
        paddingLeft: 7,
        paddingRight: 9,
      }}
    >
      <WalletGlyph colors={colors} />
      <View style={{ marginLeft: 6 }}>
        <Text style={{ fontSize: 5.6, color: "#c9c9cc", letterSpacing: 0.3 }}>Ajouter à</Text>
        <Text style={{ fontSize: 8.4, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 0.5 }}>{label}</Text>
      </View>
    </View>
  );
}

/** Marque aswallet (carré dégradé + 6 points), dessinée en vectoriel. */
function AswalletMark({ size }: { size: number }) {
  const dots = [0, 1, 2];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="aswMark" cx="0.15" cy="0.1" r="1.25">
          <Stop offset="0" stopColor="#1db87c" />
          <Stop offset="1" stopColor="#f0c232" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={24} height={24} rx={6} fill="url(#aswMark)" />
      {dots.map((i) => (
        <Circle key={`a${i}`} cx={7 + i * 5} cy={9.6} r={1.9} fill="#ffffff" />
      ))}
      {dots.map((i) => (
        <Circle key={`b${i}`} cx={7 + i * 5} cy={14.6} r={1.9} fill="#ffffff" fillOpacity={0.55} />
      ))}
    </Svg>
  );
}

/** Zone de l'illustration « carte Wallet » (affiche sans photo). */
const MOCKUP_W = 236;
const MOCKUP_H = 148;
const MOCKUP_TILT = -7;
function mockupFrame(nameTop: number) {
  // Colonne de droite, sous la marge haute ; réduite si le nom (2 lignes) remonte.
  const top = 44;
  const rad = (Math.abs(MOCKUP_TILT) * Math.PI) / 180;
  const boundH = MOCKUP_W * Math.sin(rad) + MOCKUP_H * Math.cos(rad);
  const available = nameTop - 22 - top;
  const scale = Math.max(0.55, Math.min(1.08, available / boundH));
  const cx = PAGE_W - MARGIN - (MOCKUP_W * scale) / 2 - 10;
  const cy = top + (boundH * scale) / 2;
  return { scale, cx, cy };
}

/**
 * Illustration de repli (sans photo) : la carte de fidélité telle qu'elle
 * apparaît dans le Wallet, inclinée, aux couleurs du commerce.
 */
function PassMockup({
  theme,
  businessName,
  logo,
  nameTop,
}: {
  theme: Theme;
  businessName: string;
  logo: LogoAsset | null;
  nameTop: number;
}) {
  const { scale, cx, cy } = mockupFrame(nameTop);
  const card = theme.dark ? mix(theme.bg, "#ffffff", 0.1) : mix(theme.bg, "#000000", 0.09);
  const border = mix(card, theme.text, 0.22);
  const stampLine = mix(card, theme.text, 0.4);
  const pad = 16;
  const stamp = 24;
  const gap = (MOCKUP_W - 2 * pad - 5 * stamp) / 4;
  const logoSize = 26;
  const logoW = logo ? Math.min(logoSize * logo.aspect, 64) : logoSize;
  const nameMax = MOCKUP_W - 2 * pad - logoW - 8 - 52;
  const label = fitText(businessName, {
    maxWidth: nameMax,
    maxSizes: [11.5],
    minSize: 8,
    bold: true,
    lineHeight: 1.1,
    maxHeight: 14,
  });
  const frame = {
    position: "absolute" as const,
    left: cx - MOCKUP_W / 2,
    top: cy - MOCKUP_H / 2,
    width: MOCKUP_W,
    height: MOCKUP_H,
    borderRadius: 16,
    transform: `rotate(${MOCKUP_TILT}deg) scale(${scale.toFixed(3)})`,
  };

  return (
    <>
      {/* Ombre douce (3 couches décalées). */}
      {[0.07, 0.06, 0.05].map((alpha, i) => (
        <View
          key={alpha}
          style={{
            ...frame,
            left: frame.left - i * 3,
            top: frame.top + 10 + i * 3,
            width: MOCKUP_W + i * 6,
            height: MOCKUP_H + i * 4,
            borderRadius: 16 + i * 3,
            backgroundColor: `rgba(0,0,0,${alpha})`,
          }}
        />
      ))}
      <View style={{ ...frame, backgroundColor: card, borderWidth: 0.8, borderColor: border, padding: pad }}>
        <View style={{ flexDirection: "row", alignItems: "center", height: logoSize }}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (PDF), pas un <img> HTML
            <Image src={logo.src} style={{ width: logoW, height: logoSize }} />
          ) : (
            <View style={{ width: logoSize, height: logoSize, borderRadius: 8, backgroundColor: theme.accentFill }} />
          )}
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: label.size,
              color: theme.text,
              marginLeft: 8,
              width: nameMax,
              maxLines: 1,
            }}
          >
            {label.lines[0] ?? ""}
          </Text>
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: 8,
              letterSpacing: 0.4,
              color: theme.text,
              opacity: 0.7,
              width: 52,
              textAlign: "right",
            }}
          >
            7 / 10
          </Text>
        </View>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: "row", marginTop: row === 0 ? 16 : 10 }}>
            {[0, 1, 2, 3, 4].map((col) => {
              const filled = row * 5 + col < 7;
              return (
                <View
                  key={col}
                  style={{
                    width: stamp,
                    height: stamp,
                    borderRadius: stamp / 2,
                    marginLeft: col === 0 ? 0 : gap,
                    ...(filled
                      ? { backgroundColor: theme.accentFill }
                      : { borderWidth: 1.2, borderColor: stampLine }),
                  }}
                >
                  {filled ? (
                    <Svg width={stamp} height={stamp} viewBox="0 0 24 24">
                      <Path
                        d="M7.2 12.4l3.1 3.1 6.5-6.6"
                        fill="none"
                        stroke={theme.accentInk}
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
        <View style={{ marginTop: 14, height: 3, borderRadius: 2, backgroundColor: mix(card, theme.text, 0.18) }}>
          <View style={{ width: "70%", height: 3, borderRadius: 2, backgroundColor: theme.accentFill }} />
        </View>
      </View>
    </>
  );
}

/** Motif de repli (sans photo) : ondes concentriques + halo d'accent. */
function HeroPattern({ theme, nameTop }: { theme: Theme; nameTop: number }) {
  const { cx, cy } = mockupFrame(nameTop);
  const RINGS = 14;
  const rings = Array.from({ length: RINGS }, (_, i) => 70 + i * 38);
  // Pleine page : halo et ondes s'estompent d'eux-mêmes (aucune arête nette).
  return (
    <Svg width={PAGE_W} height={PAGE_H} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id="glow" cx={cx} cy={cy} r={380} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={theme.accentFill} stopOpacity={theme.dark ? 0.34 : 0.26} />
          <Stop offset="1" stopColor={theme.accentFill} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="url(#glow)" />
      {rings.map((r, i) => (
        <Circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={theme.accent}
          strokeWidth={0.9}
          strokeOpacity={0.3 * (1 - i / RINGS) ** 1.6}
        />
      ))}
    </Svg>
  );
}

/**
 * Document PDF de l'affiche. Appelé comme une fonction (et non en JSX) par
 * {@link renderPosterPdf} : `renderToBuffer` attend un `<Document>` racine.
 */
export function PosterDocument({ theme, layout, businessName, photo, logo, qr, qrDataUrl }: PosterModel) {
  const { name, offer, cta } = layout;
  const heroH = layout.heroH;
  const onPhoto = Boolean(photo);
  const notchX = CONTENT_W - STUB_W;
  const textMuted = rgba(theme.text, 0.72);

  const logoH = layout.logoH;
  const logoW = logo ? Math.min(logoH * logo.aspect, logoH * 2.6) : 0;

  const pillStyle = onPhoto
    ? { backgroundColor: "rgba(10,10,10,0.5)", color: "#ffffff" }
    : { backgroundColor: rgba(theme.text, 0.08), color: theme.text };

  return (
    <Document title={`Affiche fidélité · ${businessName}`} author="aswallet" creator="aswallet" producer="aswallet">
      {/* wrap={false} : jamais de 2e page. La racine de hauteur fixe donne
          sa hauteur à la page (sinon react-pdf la calcule d'après un contenu
          100 % positionné en absolu, donc nulle). */}
      <Page size="A4" wrap={false} style={{ backgroundColor: theme.bg, fontFamily: "Helvetica" }}>
        <View style={{ width: PAGE_W, height: PAGE_H, overflow: "hidden" }}>
        {/* ── Visuel ─────────────────────────────────────────────────── */}
        {photo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (PDF), pas un <img> HTML
          <Image src={photo} style={{ position: "absolute", top: 0, left: 0, width: PAGE_W, height: heroH }} />
        ) : (
          <>
            <HeroPattern theme={theme} nameTop={layout.nameTop} />
            <PassMockup theme={theme} businessName={businessName} logo={logo} nameTop={layout.nameTop} />
          </>
        )}

        {/* ── En-tête : logo + mention ───────────────────────────────── */}
        <View
          wrap={false}
          style={{
            position: "absolute",
            top: MASTHEAD_TOP,
            left: MARGIN,
            width: CONTENT_W,
            height: logoH,
            flexDirection: "row",
            alignItems: "center",
            // Avec photo : logo à gauche, mention à droite. Sans photo : les
            // deux à gauche, la droite accueille l'illustration de la carte.
            justifyContent: logo && onPhoto ? "space-between" : "flex-start",
          }}
        >
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (PDF), pas un <img> HTML
            <Image src={logo.src} style={{ width: logoW, height: logoH }} />
          ) : null}
          <View
            style={{
              ...pillStyle,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
              marginLeft: logo && !onPhoto ? 16 : 0,
            }}
          >
            <View
              style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.accentFill, marginRight: 7 }}
            />
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.8 }}>
              CARTE DE FIDÉLITÉ
            </Text>
          </View>
        </View>

        {/* ── Nom du commerce ─────────────────────────────────────────── */}
        <View wrap={false} style={{ position: "absolute", top: layout.nameTop, left: MARGIN, width: CONTENT_W }}>
          <View style={{ flexDirection: "row", alignItems: "center", height: EYEBROW_H - 4, marginBottom: 4 }}>
            <View style={{ width: 22, height: 2, backgroundColor: theme.accent, marginRight: 8 }} />
            <Text style={{ fontFamily: "Times-Italic", fontSize: 16, color: theme.text }}>Bienvenue chez</Text>
          </View>
          <Text
            hyphenationCallback={noHyphenation}
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: name.size,
              lineHeight: 1.02,
              letterSpacing: name.tracking,
              color: theme.text,
              maxLines: name.lines.length,
            }}
          >
            {name.lines.join("\n")}
          </Text>
        </View>

        {/* ── Offre : le ticket ───────────────────────────────────────── */}
        <View
          wrap={false}
          style={{ position: "absolute", top: TICKET_TOP, left: MARGIN, width: CONTENT_W, height: TICKET_H }}
        >
          <Svg width={CONTENT_W} height={TICKET_H} style={{ position: "absolute", top: 0, left: 0 }}>
            <Path d={ticketPath(CONTENT_W, TICKET_H, notchX)} fill={theme.accentFill} />
            <Line
              x1={notchX}
              y1={18}
              x2={notchX}
              y2={TICKET_H - 18}
              stroke={theme.accentInk}
              strokeOpacity={0.45}
              strokeWidth={1.2}
              strokeDasharray="3,4"
            />
          </Svg>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: TICKET_PAD_X,
              width: notchX - 2 * TICKET_PAD_X,
              height: TICKET_H,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Helvetica-Bold",
                fontSize: 8,
                letterSpacing: 2.2,
                color: theme.accentInk,
                opacity: 0.78,
                marginBottom: 8,
              }}
            >
              VOTRE RÉCOMPENSE
            </Text>
            <Text
              hyphenationCallback={noHyphenation}
              style={{
                fontFamily: "Helvetica-Bold",
                fontSize: offer.size,
                lineHeight: 1.1,
                letterSpacing: offer.tracking,
                color: theme.accentInk,
                maxLines: offer.lines.length,
              }}
            >
              {offer.lines.join("\n")}
            </Text>
          </View>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: notchX,
              width: STUB_W,
              height: TICKET_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GiftIcon size={38} color={theme.accentInk} />
          </View>
        </View>

        {/* ── Colonne gauche : appel à l'action + étapes ──────────────── */}
        <View
          wrap={false}
          style={{ position: "absolute", top: CARD_TOP, left: MARGIN, width: LEFT_W, height: CARD_H }}
        >
          <Text
            hyphenationCallback={noHyphenation}
            style={{
              fontFamily: "Helvetica-Bold",
              fontSize: cta.size,
              lineHeight: 1.08,
              letterSpacing: cta.tracking,
              color: theme.text,
              maxLines: cta.lines.length,
            }}
          >
            {cta.lines.join("\n")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
            <Svg width={74} height={12} viewBox="0 0 74 12">
              <Line x1={0} y1={6} x2={70} y2={6} stroke={theme.accent} strokeWidth={2} strokeLinecap="round" />
              <Path
                d="M64 1 L71 6 L64 11"
                fill="none"
                stroke={theme.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={{ fontSize: 10.5, color: textMuted, marginTop: 12, lineHeight: 1.35 }}>
            {"Gratuit et immédiat. Aucune application\nà télécharger."}
          </Text>

          <View style={{ position: "absolute", left: 0, bottom: 0, width: LEFT_W }}>
            <View style={{ height: 0.8, backgroundColor: rgba(theme.text, 0.18), marginBottom: 12 }} />
            {STEPS.map((label, i) => (
              <View
                key={label}
                style={{ flexDirection: "row", alignItems: "center", marginTop: i === 0 ? 0 : 10 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: theme.accentFill,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: theme.accentInk }}>
                    {String(i + 1)}
                  </Text>
                </View>
                <Text style={{ fontSize: 10.8, color: theme.text, maxLines: 1 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Carte QR ─────────────────────────────────────────────────── */}
        <View
          wrap={false}
          style={{
            position: "absolute",
            top: CARD_TOP,
            left: CARD_LEFT,
            width: CARD_W,
            height: CARD_H,
            backgroundColor: "#ffffff",
            borderRadius: 22,
            // Filet seulement si la carte blanche se détache mal du fond.
            ...(contrast(theme.bg, "#ffffff") < 1.35
              ? { borderWidth: 0.8, borderColor: mix(theme.bg, "#000000", 0.14) }
              : {}),
          }}
        >
          <View style={{ position: "absolute", top: QR_PAD, left: QR_PAD, width: QR_SIZE, height: QR_SIZE }}>
            {qr ? (
              <Svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${qr.size} ${qr.size}`}>
                <Path d={qr.d} fill="#000000" />
              </Svg>
            ) : (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (PDF), pas un <img> HTML
              <Image src={qrDataUrl ?? ""} style={{ width: QR_SIZE, height: QR_SIZE }} />
            )}
          </View>
          <View
            style={{
              position: "absolute",
              top: QR_PAD + QR_SIZE + 12,
              left: QR_PAD,
              width: QR_SIZE,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <WalletPill label="Apple Wallet" colors={["#3a9cf2", "#46c26a", "#f6b83c", "#ef5a4c"]} />
            <WalletPill label="Google Wallet" colors={["#4285f4", "#34a853", "#fbbc04", "#ea4335"]} />
          </View>
        </View>

        {/* ── Pied ─────────────────────────────────────────────────────── */}
        <View
          wrap={false}
          style={{
            position: "absolute",
            top: FOOTER_TOP,
            left: 0,
            width: PAGE_W,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 7.5, color: rgba(theme.text, 0.55), marginRight: 5 }}>Propulsé par</Text>
          <AswalletMark size={9} />
          <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: rgba(theme.text, 0.75), marginLeft: 4 }}>
            aswallet
          </Text>
        </View>
        </View>
      </Page>
    </Document>
  );
}
