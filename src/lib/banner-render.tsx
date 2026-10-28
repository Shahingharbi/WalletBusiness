/**
 * Rendu de la BANDE des cartes Wallet (strip Apple, heroImage Google, aperçu
 * du site), un visuel propre à chaque type de carte :
 *
 *  - stamp      : grille de tampons (forme + icône du commerçant) ;
 *  - cashback   : jauge de points sur un panneau « verre dépoli » ;
 *  - discount   : sceau promotionnel avec la remise (« −10 % », « −5 € ») ;
 *  - membership : plaque premium noir & or, couronne, « VIP » / « MEMBRE ».
 *
 * `renderBanner` est PURE (aucun I/O) : elle renvoie l'élément JSX que la route
 * passe à `ImageResponse` (Satori). `preparePhoto` normalise la photo via
 * sharp (et en tire une version floutée pour le verre dépoli).
 *
 * Règles Satori respectées partout :
 *  - aucune propriété CSS à `undefined` (le Satori de next 16 plante,
 *    « reading 'trim' ») : clés absentes via spread conditionnel ;
 *  - tout `div` à plusieurs enfants est en `display: flex` ;
 *  - aucun glyphe exotique dans le texte (police Geist seule ; un glyphe
 *    manquant déclenche un téléchargement de police Google au rendu) : les
 *    icônes (étoile, couronne) sont des `<path>` SVG.
 */
import type { CSSProperties, ReactElement } from "react";
import {
  getIconPath,
  getShapePath,
  normalizeIconKey,
  normalizeShape,
  type StampShape,
} from "@/lib/stamp-render";
import { pickContrast as pickContrastSync } from "@/lib/utils";

// Apple Wallet — storeCard avec QR : strip.png attendu en 375×123 (1x), 750×246 (2x),
// 1125×369 (3x). On génère le @3x et iOS scale les autres. Ratio ~3:1.
// Apple **rejette silencieusement** une strip dont les dimensions ne respectent
// pas ce format (résultat: bannière invisible côté pass).
// Google Wallet — heroImage accepte n'importe quel ratio ; 1125×369 marche aussi.
export const BANNER_WIDTH = 1125;
export const BANNER_HEIGHT = 369;
const WIDTH = BANNER_WIDTH;
const HEIGHT = BANNER_HEIGHT;

/** Panneau « verre dépoli » de la jauge de points, centré dans la bande. */
const POINTS_PANEL = (() => {
  const w = 880;
  const h = 262;
  return { w, h, left: Math.round((WIDTH - w) / 2), top: Math.round((HEIGHT - h) / 2) };
})();

export type BannerKind = "stamp" | "cashback" | "discount" | "membership";

const KINDS: BannerKind[] = ["stamp", "cashback", "discount", "membership"];

function asKind(v: unknown): BannerKind | null {
  return typeof v === "string" && (KINDS as string[]).includes(v) ? (v as BannerKind) : null;
}

/**
 * Type de bande à rendre : le `?kind=` de l'URL s'il est valide (c'est ce que
 * l'appelant demande explicitement), sinon `cards.card_type`, sinon « stamp ».
 */
export function resolveBannerKind(kindParam: unknown, cardType: unknown): BannerKind {
  return asKind(kindParam) ?? asKind(cardType) ?? "stamp";
}

export interface BannerInput {
  kind: BannerKind;
  /** Photo du commerce normalisée (data URI 1125×369) ou null. */
  photo: string | null;
  /** Même photo floutée (verre dépoli) ; null → panneau teinté uni. */
  photoBlurred: string | null;
  /**
   * Clarté moyenne (0..1) de la photo floutée sous le panneau de points :
   * plus elle est claire, plus le verre est teinté (texte blanc lisible).
   */
  photoLuma: number | null;
  /** design.accent_color */
  accent: string;
  /** design.background_color (couleur de la carte derrière une bande sans photo). */
  background: string;
  /** cards.stamp_count (tampons ou échelle des points). */
  total: number;
  /** card_instances.stamps_collected */
  collected: number;
  /** cards.reward_text (la remise y est lue pour le type « discount »). */
  rewardText: string | null;
  /** design.label_stamps (« Points », « Visites »…). */
  label: string | null;
  stampShape: StampShape;
  stampIcon: string;
  stampActiveUrl: string | null;
  stampInactiveUrl: string | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Construit l'entrée du rendu depuis la carte telle que lue en base. */
export function buildBannerInput(p: {
  kind: BannerKind;
  design: Record<string, unknown>;
  stampCount: number;
  stampsCollected: number;
  rewardText: string | null;
  photo: string | null;
  photoBlurred?: string | null;
  photoLuma?: number | null;
}): BannerInput {
  const d = p.design;
  return {
    kind: p.kind,
    photo: p.photo,
    photoBlurred: p.photoBlurred ?? null,
    photoLuma: typeof p.photoLuma === "number" && Number.isFinite(p.photoLuma) ? p.photoLuma : null,
    // Brut pour la grille de tampons (rendu historique inchangé) ; les autres
    // visuels le normalisent avant tout calcul de couleur.
    accent: str(d.accent_color) ?? "#10b981",
    background: normalizeHex(str(d.background_color), "#1a1a1a"),
    total: Math.max(1, Math.floor(Number(p.stampCount) || 1)),
    collected: Math.max(0, Math.floor(Number(p.stampsCollected) || 0)),
    rewardText: str(p.rewardText),
    label: str(d.label_stamps),
    stampShape: normalizeShape(d.stamp_shape),
    // SEULE source de vérité = `design.stamp_icon` (celle que le designer
    // met à jour au clic). L'ancien `stamp_active_icon` valait toujours
    // "check" par défaut et court-circuitait le vrai choix du commerçant.
    stampIcon: normalizeIconKey(str(d.stamp_icon), "check"),
    stampActiveUrl: str(d.stamp_active_url) ?? str(d.activeImageUrl),
    stampInactiveUrl: str(d.stamp_inactive_url) ?? str(d.inactiveImageUrl),
  };
}

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  const s = hex.trim().replace(/^#/, "");
  const full = /^[a-f\d]{3}$/i.test(s) ? s.replace(/./g, (c) => c + c) : s;
  if (!/^[a-f\d]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function normalizeHex(v: string | null, fallback: string): string {
  const rgb = v ? parseHex(v) : null;
  return rgb ? toHex(rgb) : fallback;
}

/** Mélange `a` vers `b` (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number): string {
  const x = parseHex(a) ?? [0, 0, 0];
  const y = parseHex(b) ?? [0, 0, 0];
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex) ?? [0, 0, 0];
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Luminance relative WCAG (0..1). */
function relLum(hex: string): number {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Variante de `color` lisible sur `surface` (contraste ≥ `min`) : on éclaircit
 * (surface sombre) ou on assombrit (surface claire) juste ce qu'il faut, pour
 * garder la teinte de la marque.
 */
function readableOn(color: string, surface: string, min: number): string {
  const towards = relLum(surface) < 0.18 ? "#ffffff" : "#000000";
  for (let t = 0; t <= 1.0001; t += 0.08) {
    const c = mix(color, towards, t);
    if (contrast(c, surface) >= min) return c;
  }
  return towards;
}

// ---------------------------------------------------------------------------
// Photo (sharp) — seule partie non pure, isolée ici pour que la route et les
// tests préparent la photo exactement de la même façon.
// ---------------------------------------------------------------------------

/**
 * Normalise une photo quelconque (HEIC, AVIF, PNG géant, CMYK…) en JPEG sRGB
 * 1125×369 « cover » que Satori avale toujours, + une version floutée (verre
 * dépoli). SVG : embarqué tel quel, sans flou. Renvoie null si indécodable.
 */
export async function preparePhoto(
  buf: Buffer,
  opts: { blurred?: boolean } = {},
): Promise<{ photo: string; photoBlurred: string | null; photoLuma: number | null } | null> {
  const head = buf.subarray(0, Math.min(buf.length, 64)).toString("utf8");
  if (head.trim().startsWith("<?xml") || head.includes("<svg")) {
    return {
      photo: `data:image/svg+xml;base64,${buf.toString("base64")}`,
      photoBlurred: null,
      photoLuma: null,
    };
  }
  const { default: sharp } = await import("sharp");
  let out = await sharp(buf, { failOn: "none" })
    .rotate() // applique l'EXIF orientation
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // alpha -> blanc
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "center" })
    .toColorspace("srgb")
    .jpeg({ quality: 88, progressive: false, mozjpeg: true })
    .toBuffer();
  if (out.length > 4_000_000) {
    // Cap dur à 4 Mo (Satori plante au-delà). Re-compresse plus agressif.
    out = await sharp(out).jpeg({ quality: 70, progressive: false, mozjpeg: true }).toBuffer();
    if (out.length > 4_000_000) return null;
  }
  let photoBlurred: string | null = null;
  let photoLuma: number | null = null;
  if (opts.blurred) {
    try {
      const blur = await sharp(out)
        .blur(22)
        .modulate({ saturation: 1.15 })
        .jpeg({ quality: 70, progressive: false, mozjpeg: true })
        .toBuffer();
      photoBlurred = `data:image/jpeg;base64,${blur.toString("base64")}`;
      // Clarté de la zone du panneau (centre de la bande).
      const { channels } = await sharp(blur)
        .extract({ left: POINTS_PANEL.left, top: POINTS_PANEL.top, width: POINTS_PANEL.w, height: POINTS_PANEL.h })
        .stats();
      const [r, g = r, b = r] = channels.map((c) => c.mean / 255);
      photoLuma = 0.299 * r + 0.587 * g + 0.114 * b;
    } catch {
      photoBlurred = null;
      photoLuma = null;
    }
  }
  return { photo: `data:image/jpeg;base64,${out.toString("base64")}`, photoBlurred, photoLuma };
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

const FONT = "system-ui, -apple-system, sans-serif";

/** Faux gras : Satori n'a que Geist Regular, on épaissit au contour. */
function bold(px: number, color: string): CSSProperties {
  return { WebkitTextStroke: `${px}px ${color}` };
}

export function renderBanner(input: BannerInput): ReactElement {
  switch (input.kind) {
    case "cashback":
      return renderPoints(input);
    case "discount":
      return renderDiscount(input);
    case "membership":
      return renderVip(input);
    default:
      return renderStampGrid(input);
  }
}

/** Fond commun des visuels « objet sur photo » (points, remise, VIP). */
function Scene(p: { photo: string | null; veil: string; children: ReactElement | ReactElement[] }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Sans photo : TRANSPARENT, Apple/Google posent la couleur de la carte
        // derrière (même couleur que le reste du pass sur chaque plateforme).
        ...(p.photo
          ? { backgroundImage: `url(${p.photo})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}),
        backgroundColor: "transparent",
        fontFamily: FONT,
        color: "white",
        position: "relative",
      }}
    >
      {p.photo ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage: p.veil,
          }}
        />
      ) : (
        <div style={{ display: "none" }} />
      )}
      {p.children}
    </div>
  );
}

// ----------------------------------------------------------------- Points ---

function starPath(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    parts.push(`${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return parts.join(" ") + " Z";
}

/** Unité du compteur : « points » par défaut, sinon le libellé du commerçant. */
function pointsUnit(label: string | null, n: number): string {
  // Sans libellé propre : « visites », comme le compteur Wallet et le tableau
  // de bord (cashback = visites avant récompense). Les essais stockent « Points ».
  const raw = label && label.length <= 12 && !/^tampons?$/i.test(label) ? label.toLowerCase() : "visites";
  if (n > 1) return raw;
  return raw.endsWith("s") && raw.length > 3 ? raw.slice(0, -1) : raw;
}

function renderPoints(input: BannerInput) {
  const total = input.total;
  const collected = Math.min(input.collected, total);
  const remaining = Math.max(0, total - collected);
  const ratio = total > 0 ? collected / total : 0;
  const hasPhoto = Boolean(input.photo);
  const glass = hasPhoto && Boolean(input.photoBlurred);
  const accent = normalizeHex(input.accent, "#10b981");

  // Surface du panneau : verre sombre sur photo ; sans photo, une nuance de
  // la couleur de la carte (opaque, donc lisible quelle que soit la
  // plateforme derrière).
  const bgDark = relLum(input.background) < 0.3;
  const surface = hasPhoto
    ? "#262626"
    : bgDark
      ? mix(input.background, "#ffffff", 0.1)
      : mix(input.background, "#ffffff", 0.55);
  const darkSurface = relLum(surface) < 0.3;
  const ink = darkSurface ? "#ffffff" : "#161616";
  const inkSoft = rgba(ink, darkSurface ? 0.78 : 0.68);
  const track = darkSurface ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.10)";
  const bar = readableOn(accent, surface, 2.6);
  const barHi = mix(bar, "#ffffff", 0.3);
  const coin = accent;
  const coinInk = pickContrastSync(coin);
  // Teinte du verre : d'autant plus sombre que la photo floutée est claire,
  // pour que le texte blanc reste lisible sur une photo très lumineuse.
  const luma = input.photoLuma ?? 0.5;
  const tint = glass ? Math.min(0.62, Math.max(0.16, 1 - 0.36 / Math.max(luma, 0.01))) : 0.55;

  const { w: PW, h: PH, left, top } = POINTS_PANEL;
  const RADIUS = 44;
  const COIN = 156;
  const PAD_L = 48;
  const PAD_R = 54;
  const GAP = 44;
  const COL = PW - PAD_L - PAD_R - COIN - GAP;
  const BAR_H = 22;

  const unit = pointsUnit(input.label, total);
  const unitLeft = pointsUnit(input.label, remaining);
  const CAPTION_SIZE = 30;
  const longCaption = `Plus que ${remaining} ${unitLeft} avant la récompense`;
  // Geist ≈ 0,49 em par caractère : on raccourcit plutôt que de déborder.
  const caption =
    remaining === 0
      ? "Récompense débloquée !"
      : longCaption.length * CAPTION_SIZE * 0.49 <= COL - 6
        ? longCaption
        : `Plus que ${remaining} ${unitLeft}`;
  const big = String(collected);
  const bigSize = big.length >= 3 ? 104 : 124;
  const fill = collected > 0 ? Math.max(BAR_H, Math.round(COL * ratio)) : 0;

  return (
    <Scene
      photo={input.photo}
      veil="linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.40) 100%)"
    >
      {/* Chaque calque porte son propre arrondi : Satori ne découpe pas les
          enfants (img, ombre) avec `overflow: hidden` + border-radius. */}
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: PW,
          height: PH,
          display: "flex",
          borderRadius: RADIUS,
          backgroundColor: hasPhoto ? "#262626" : surface,
          boxShadow: "0 16px 38px rgba(0,0,0,0.32)",
        }}
      >
        {/* Verre dépoli : la photo floutée, recalée pile sous le panneau. */}
        {glass ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              borderRadius: RADIUS,
              backgroundImage: `url(${input.photoBlurred})`,
              backgroundSize: `${WIDTH}px ${HEIGHT}px`,
              backgroundPosition: `-${left}px -${top}px`,
              backgroundRepeat: "no-repeat",
            }}
          />
        ) : (
          <div style={{ display: "none" }} />
        )}
        {/* Teinte + reflet du verre, puis liseré clair. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            borderRadius: RADIUS,
            backgroundColor: hasPhoto ? `rgba(12,12,12,${tint.toFixed(2)})` : "transparent",
            backgroundImage: hasPhoto
              ? "linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0) 70%)"
              : "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            borderRadius: RADIUS,
            border: hasPhoto
              ? "2px solid rgba(255,255,255,0.30)"
              : `2px solid ${darkSurface ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: PW,
            height: PH,
            display: "flex",
            alignItems: "center",
            paddingLeft: PAD_L,
            // Centrage optique : le grand chiffre a un blanc interne en haut.
            paddingBottom: 12,
          }}
        >
          {/* Pièce : accent + étoile. */}
          <svg width={COIN} height={COIN} viewBox="0 0 100 100" style={{ display: "flex", flexShrink: 0 }}>
            <defs>
              <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={mix(coin, "#ffffff", 0.35)} />
                <stop offset="0.55" stopColor={coin} />
                <stop offset="1" stopColor={mix(coin, "#000000", 0.3)} />
              </linearGradient>
            </defs>
            <circle cx="50" cy="53" r="45" fill="#000000" fillOpacity={0.28} />
            <circle cx="50" cy="50" r="45" fill="url(#coin)" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={2} />
            <circle cx="50" cy="50" r="36" fill="none" stroke={coinInk} strokeOpacity={0.35} strokeWidth={1.6} />
            <path
              d={starPath(50, 51.5, 22, 9.5)}
              fill={coinInk}
              stroke={coinInk}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          </svg>

          <div style={{ display: "flex", flexDirection: "column", width: COL, marginLeft: GAP }}>
            <div style={{ display: "flex", alignItems: "baseline", color: ink }}>
              <span style={{ fontSize: bigSize, lineHeight: 1, letterSpacing: -3, ...bold(3, ink) }}>{big}</span>
              <span style={{ fontSize: 46, lineHeight: 1, marginLeft: 14, color: inkSoft, ...bold(0.6, inkSoft) }}>
                {`/ ${total} ${unit}`}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 22,
                height: BAR_H,
                width: COL,
                borderRadius: BAR_H / 2,
                backgroundColor: track,
              }}
            >
              {fill > 0 ? (
                <div
                  style={{
                    display: "flex",
                    width: fill,
                    height: BAR_H,
                    borderRadius: BAR_H / 2,
                    backgroundImage: `linear-gradient(90deg, ${bar} 0%, ${barHi} 100%)`,
                    boxShadow: `0 0 16px ${rgba(bar, 0.5)}`,
                  }}
                />
              ) : (
                <div style={{ display: "none" }} />
              )}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: CAPTION_SIZE,
                color: inkSoft,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
              }}
            >
              {caption}
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}

// ----------------------------------------------------------------- Remise ---

/**
 * Remise lue dans `reward_text` : « −10 % sur tout » → { amount: "10", unit:
 * "%" } ; « 5 € offerts dès 30 € » → { amount: "5", unit: "€" }. Le
 * pourcentage prime sur l'euro (« −10 % dès 20 € d'achat »). Null si aucune.
 */
export function extractDiscount(text: string | null | undefined): { amount: string; unit: "%" | "€" } | null {
  const s = (text ?? "").replace(/[  ]/g, " ");
  const pct = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/.exec(s);
  if (pct) {
    const n = Number(pct[1].replace(",", "."));
    if (n > 0 && n <= 100) return { amount: pct[1].replace(".", ","), unit: "%" };
  }
  // Plusieurs montants (« Dès 30 € d'achat, 5 € offerts ») : celui précédé
  // d'un moins, sinon celui suivi de « offert / de remise », sinon le seul ;
  // ambigu → null (sceau « % » générique plutôt qu'un montant faux).
  const AMT = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)`;
  const all = [...s.matchAll(new RegExp(AMT, "gi"))];
  const eur =
    new RegExp(String.raw`[-−–]\s*` + AMT, "i").exec(s) ??
    new RegExp(AMT + String.raw`\s*(?:offerts?|de\s+(?:remise|r[ée]duction))`, "i").exec(s) ??
    (all.length === 1 ? all[0] : null) ??
    (all.length === 0 ? /€\s*(\d{1,4}(?:[.,]\d{1,2})?)/.exec(s) : null);
  if (eur && Number(eur[1].replace(",", ".")) > 0) return { amount: eur[1].replace(".", ","), unit: "€" };
  return null;
}

/** Contour de sceau « éclaté » (viewBox centrée sur 0,0). */
function sealPath(points: number, outer: number, inner: number): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    parts.push(`${i === 0 ? "M" : "L"}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`);
  }
  return parts.join(" ") + " Z";
}

function renderDiscount(input: BannerInput) {
  const deal = extractDiscount(input.rewardText);
  const accent = normalizeHex(input.accent, "#10b981");
  // Le sceau doit se détacher de ce qu'il y a derrière : photo assombrie, ou
  // couleur de la carte (sans photo) → on décale l'accent si trop proche.
  const behind = input.photo ? "#2a2a2a" : input.background;
  const seal = contrast(accent, behind) >= 1.6 ? accent : readableOn(accent, behind, 1.8);
  const ink = pickContrastSync(seal);
  const S = 336;
  const main = deal ? `−${deal.amount}` : "%";
  // Taille du chiffre ajustée à sa longueur (le sceau fait ~250 px utiles).
  const mainSize = deal
    ? Math.max(64, Math.min(118, Math.floor(232 / (main.length * 0.6 + (deal.unit === "%" ? 0.52 : 0.4)))))
    : 150;

  return (
    <Scene
      photo={input.photo}
      veil="radial-gradient(circle at 50% 50%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.55) 100%)"
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: S,
          height: S,
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(-8deg)",
        }}
      >
        <svg
          width={S}
          height={S}
          viewBox="-100 -100 200 200"
          style={{ position: "absolute", left: 0, top: 0, display: "flex" }}
        >
          <defs>
            <radialGradient id="seal" cx="0.35" cy="0.3" r="0.85">
              <stop offset="0" stopColor={mix(seal, "#ffffff", 0.28)} />
              <stop offset="0.6" stopColor={seal} />
              <stop offset="1" stopColor={mix(seal, "#000000", 0.22)} />
            </radialGradient>
          </defs>
          <path d={sealPath(22, 96, 86)} fill="#000000" fillOpacity={0.35} transform="translate(0 5)" />
          <path
            d={sealPath(22, 96, 86)}
            fill="url(#seal)"
            stroke="#ffffff"
            strokeOpacity={0.85}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <circle r="74" fill="none" stroke={ink} strokeOpacity={0.55} strokeWidth={1.4} />
          <circle r="69" fill="none" stroke={ink} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="2.2 3" />
        </svg>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: ink,
          }}
        >
          <div style={{ display: "flex", fontSize: 25, letterSpacing: 7, marginBottom: deal ? 2 : -6, ...bold(0.5, ink) }}>
            REMISE
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: mainSize, lineHeight: 1, letterSpacing: -2, ...bold(3, ink) }}>{main}</span>
            {deal ? (
              <span style={{ fontSize: Math.round(mainSize * 0.56), lineHeight: 1, marginLeft: 4, ...bold(2, ink) }}>
                {deal.unit}
              </span>
            ) : (
              <span style={{ display: "none" }} />
            )}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 6,
              width: 64,
              height: 3,
              borderRadius: 2,
              backgroundColor: rgba(ink, 0.6),
            }}
          />
        </div>
      </div>
    </Scene>
  );
}

// -------------------------------------------------------------------- VIP ---

const GOLD = "linear-gradient(120deg, #8a6420 0%, #d9b45a 22%, #fbeeb0 42%, #d4a94a 60%, #9c7426 82%, #e8cd7e 100%)";
const GOLD_TEXT = "linear-gradient(180deg, #fff3c4 0%, #f0d27e 40%, #c99a3c 75%, #e9c76f 100%)";

/** Couronne (viewBox 0 0 24 24) : 3 pointes perlées + bandeau. */
const CROWN =
  "M3.2 18 L2 8.6 L7.4 12.4 L12 5.4 L16.6 12.4 L22 8.6 L20.8 18 Z M3.6 19.4 H20.4 V21.6 H3.6 Z";


function renderVip(input: BannerInput) {
  const PW = 640;
  const PH = 250;
  const MED = 150;
  const goldInk = "#e8cd7e";
  const vipText: CSSProperties = { fontSize: 128, lineHeight: 1, letterSpacing: 12 };
  return (
    <Scene
      photo={input.photo}
      veil="linear-gradient(135deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.55) 100%)"
    >
      {/* Plaque noire, liseré or (le dégradé or sert de bordure). */}
      <div
        style={{
          display: "flex",
          width: PW,
          height: PH,
          padding: 4,
          borderRadius: 40,
          backgroundImage: GOLD,
          boxShadow: "0 20px 44px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            borderRadius: 36,
            backgroundImage: "linear-gradient(150deg, #2c2721 0%, #131210 55%, #070707 100%)",
          }}
        >
          {/* Reflet diagonal + filet intérieur or fin. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              borderRadius: 36,
              backgroundImage:
                "linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,240,200,0.07) 45%, rgba(255,255,255,0) 60%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              bottom: 12,
              display: "flex",
              borderRadius: 26,
              border: "1.5px solid rgba(232,205,126,0.35)",
            }}
          />
          {/* Médaillon or + couronne. */}
          <svg width={MED} height={MED} viewBox="0 0 100 100" style={{ display: "flex", flexShrink: 0 }}>
            <defs>
              <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbeeb0" />
                <stop offset="0.35" stopColor="#e2bf62" />
                <stop offset="0.7" stopColor="#b48631" />
                <stop offset="1" stopColor="#e8cd7e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="52.5" r="46" fill="#000000" fillOpacity={0.4} />
            <circle cx="50" cy="50" r="46" fill="url(#gold)" />
            <circle cx="50" cy="50" r="39" fill="none" stroke="#5a3f0c" strokeOpacity={0.45} strokeWidth={1.4} />
            <g transform="translate(23 21) scale(2.25)">
              <path d={CROWN} fill="#3b2806" />
              <circle cx="2" cy="8.4" r="1.5" fill="#3b2806" />
              <circle cx="12" cy="5" r="1.7" fill="#3b2806" />
              <circle cx="22" cy="8.4" r="1.5" fill="#3b2806" />
            </g>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 42 }}>
            <div
              style={{
                display: "flex",
                fontSize: 27,
                letterSpacing: 11,
                marginLeft: 4,
                color: goldInk,
                ...bold(0.5, goldInk),
              }}
            >
              MEMBRE
            </div>
            {/* « VIP » : calque or uni épaissi + dégradé or par-dessus. */}
            <div style={{ position: "relative", display: "flex", marginTop: 6 }}>
              <div style={{ display: "flex", ...vipText, color: "#c79a3e", ...bold(3, "#c79a3e") }}>VIP</div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  display: "flex",
                  ...vipText,
                  backgroundImage: GOLD_TEXT,
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                VIP
              </div>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}


// ---------------------------------------------------------------- Tampons ---

export function pickGrid(total: number): { cols: number; rows: number } {
  const map: Record<number, [number, number]> = {
    5: [5, 1],
    6: [3, 2],
    7: [4, 2],
    8: [4, 2],
    9: [3, 3],
    10: [5, 2],
    11: [4, 3],
    12: [6, 2],
    13: [5, 3],
    14: [5, 3],
    15: [5, 3],
    16: [4, 4],
    18: [6, 3],
    20: [5, 4],
  };
  if (map[total]) return { cols: map[total][0], rows: map[total][1] };
  if (total <= 4) return { cols: total, rows: 1 };
  const cols = total > 12 ? 5 : 4;
  return { cols, rows: Math.ceil(total / cols) };
}

function renderStampGrid(input: BannerInput) {
  const bannerUrl = input.photo;
  const accent = input.accent;
  const shape = input.stampShape;
  const filledIconKey = input.stampIcon;
  // Tampons vides : même icône (cohérence visuelle).
  const emptyIconKey = filledIconKey;

  const stampsTotal = Math.max(1, Math.min(20, input.total));
  const stampsCollected = Math.max(0, Math.min(input.collected, stampsTotal));

  const { cols, rows } = pickGrid(stampsTotal);

  // La grille occupe toute l'image, centrée. Padding adaptatif : on respire
  // plus avec peu de tampons, on resserre au-delà de 12 (sinon les bords de
  // l'iPhone collent les tampons). Taille max d'un tampon capée par le NOMBRE
  // DE LIGNES pour respecter le ratio ~3:1 du strip Apple :
  // 1 ligne -> 130px, 2 lignes -> 120px, 3+ lignes -> 100px.
  const dense = stampsTotal >= 12;
  const padding = dense ? 64 : 36;
  const gap = dense ? 14 : 22;
  const maxByW = (WIDTH - padding * 2 - gap * (cols - 1)) / cols;
  const maxByH = (HEIGHT - padding * 2 - gap * (rows - 1)) / rows;
  const upperCap = rows === 1 ? 130 : rows === 2 ? 120 : 100;
  const stampSize = Math.max(48, Math.min(upperCap, Math.floor(Math.min(maxByW, maxByH))));

  const stamps: Array<{ filled: boolean; idx: number }> = [];
  for (let i = 0; i < stampsTotal; i++) {
    stamps.push({ filled: i < stampsCollected, idx: i });
  }
  const rowsArr: (typeof stamps)[] = [];
  for (let r = 0; r < rows; r++) {
    rowsArr.push(stamps.slice(r * cols, (r + 1) * cols));
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Photo si le commerçant l'a uploadée — sinon TRANSPARENT (couleur de
        // la carte posée derrière par Apple/Google). Clés absentes plutôt que
        // `undefined` (Satori plante sur une propriété CSS `undefined`).
        ...(bannerUrl
          ? {
              backgroundImage: `url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
        backgroundColor: "transparent",
        fontFamily: FONT,
        color: "white",
        padding: `${padding}px`,
        position: "relative",
      }}
    >
      {/* Voile sur la photo : assez sombre pour que les tampons ressortent. */}
      {bannerUrl && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage: "linear-gradient(135deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.42) 100%)",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${gap}px`,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {rowsArr.map((row, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: `${gap}px`,
              justifyContent: "center",
            }}
          >
            {row.map((s) =>
              renderStamp({
                filled: s.filled,
                size: stampSize,
                shape,
                accent,
                activeUrl: input.stampActiveUrl,
                inactiveUrl: input.stampInactiveUrl,
                iconKey: s.filled ? filledIconKey : emptyIconKey,
                key: s.idx,
              }),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface StampProps {
  filled: boolean;
  size: number;
  shape: StampShape;
  accent: string;
  activeUrl: string | null;
  inactiveUrl: string | null;
  iconKey: string;
  key: number;
}

function renderStamp(p: StampProps) {
  // Si le commerçant n'a uploadé QUE le tampon actif, on le réutilise pour
  // les vides à opacité réduite (sinon mélange image/SVG-fallback moche).
  const url = p.filled ? p.activeUrl : (p.inactiveUrl ?? p.activeUrl);
  if (url) {
    // Image custom : ratio gardé, forme approchée par border-radius.
    const radiusForImg = p.shape === "circle" ? "50%" : p.shape === "squircle" ? "30%" : "12%";
    return (
      <div
        key={p.key}
        style={{
          width: `${p.size}px`,
          height: `${p.size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: p.filled ? 1 : 0.5,
          borderRadius: radiusForImg,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          // Bord accent + ombre marquée même à vide pour rester visible sur photo.
          border: p.filled ? "none" : `2px solid ${p.accent}`,
          boxShadow: p.filled ? "0 8px 18px rgba(0,0,0,0.32)" : "0 3px 8px rgba(0,0,0,0.20)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          width={p.size}
          height={p.size}
          style={{ width: `${p.size}px`, height: `${p.size}px`, objectFit: "cover" }}
        />
      </div>
    );
  }

  // Forme SVG (star, shield, hex…) + icône dans le MÊME SVG (pas de SVG
  // imbriqué, incompatible Satori). REMPLI = accent plein + icône contrastée ;
  // VIDE = blanc + bord accent + icône accent (inversion fond/icône).
  const shapePath = getShapePath(p.shape);
  const iconPath = getIconPath(p.iconKey);

  if (p.filled) {
    // Icône AUTO-CONTRAST sur l'accent (accent clair → icône noire).
    const iconColor = pickContrastSync(p.accent);
    return (
      <div
        key={p.key}
        style={{
          width: `${p.size}px`,
          height: `${p.size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={{ display: "flex" }}>
          {/* Ombre portée DANS le SVG (forme décalée) : un `filter:
              drop-shadow` CSS est rendu par Satori comme un carré sombre. */}
          <path d={shapePath} fill="#000000" fillOpacity={0.3} transform="translate(0 0.75)" />
          <path d={shapePath} fill={p.accent} stroke={p.accent} strokeWidth={0.5} strokeLinejoin="round" />
          <path d={iconPath} fill={iconColor} />
        </svg>
      </div>
    );
  }

  return (
    <div
      key={p.key}
      style={{
        width: `${p.size}px`,
        height: `${p.size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={p.size} height={p.size} viewBox="0 0 24 24" style={{ display: "flex" }}>
        <path d={shapePath} fill="#000000" fillOpacity={0.2} transform="translate(0 0.5)" />
        <path d={shapePath} fill="#ffffff" stroke={p.accent} strokeWidth={2} strokeLinejoin="round" />
        <path d={iconPath} fill={p.accent} stroke={p.accent} strokeWidth={0.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
