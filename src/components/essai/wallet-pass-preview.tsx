"use client";

/**
 * Réplique fidèle d'une carte Apple Wallet (storeCard) et de son équivalent
 * Google Wallet, calquée sur de vraies captures iPhone du client.
 *
 * Toutes les cotes sont exprimées en `cqw` (pourcentage de la largeur de la
 * carte, via `container-type: inline-size`) : la carte garde exactement ses
 * proportions à toute taille, sans JavaScript de mise à l'échelle.
 *
 * Cotes Apple relevées sur les captures (carte = 680 px de large) :
 *   en-tête 115 px · logo Ø 76 · nom ≈ 30 px demi-gras · « TAMPONS » ≈ 20 px
 *   bande 375:144 (Apple recadre la bande au centre, comme object-fit: cover)
 *   rangée Bonjour / Notre offre : libellés ≈ 20 px, valeurs ≈ 31 px
 *   QR blanc 285 × 297 px à 24 px du bas · carte 680 × 998 px.
 *
 * La bande n'est PAS redessinée : c'est l'image réelle du pass
 * (`bannerUrl` : photo + tampons, jauge de points, badge remise / VIP selon
 * le type) servie au wallet, avec fondu enchaîné à chaque changement. Une
 * bande d'un autre type n'est jamais affichée : au changement de type, un
 * chargement aux couleurs de la carte la remplace jusqu'à la nouvelle.
 *
 * Effets de tampon (éclat, étincelles, position dans la grille) : type
 * « stamp » uniquement. Compteur d'en-tête : tampons et points seulement.
 */

import { useMemo, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import type { BrandColors, EssaiCardType } from "@/lib/essai/types";
import { googleEffectiveBgColor, luminance } from "@/lib/wallet-colors";
import { cn, pickContrast } from "@/lib/utils";
import styles from "./essai-wallet.module.css";

export interface WalletPassData {
  /** Token de la carte client : contenu du QR code, comme sur le vrai pass. */
  token: string;
  name: string;
  logoUrl: string | null;
  colors: BrandColors;
  cardType: EssaiCardType;
  stamps: number;
  stampCount: number;
  labelStamps: string;
  rewardText: string;
  firstName: string | null;
  /** Image réelle de la bande (photo + tampons), versionnée. */
  bannerUrl: string | null;
  /** Photo seule, en secours si la bande ne se charge pas. */
  photoUrl: string | null;
}

/** Déclencheur du « pop » d'un tampon (index 0-based du tampon ajouté). */
export interface StampPop {
  key: number;
  index: number;
}

export interface PassBusy {
  logo?: boolean;
  strip?: boolean;
  reward?: boolean;
}

interface PassProps {
  data: WalletPassData;
  pop?: StampPop | null;
  busy?: PassBusy;
}

const APPLE_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const GOOGLE_FONT =
  '"Google Sans", "Google Sans Text", Roboto, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
const COLOR_TRANSITION = "background-color 550ms ease, color 550ms ease";

const GOOGLE_TITLES: Record<EssaiCardType, string> = {
  stamp: "Carte de fidélité",
  cashback: "Carte à points",
  discount: "Carte de réduction",
  membership: "Carte VIP",
};

export function hasCounter(type: EssaiCardType): boolean {
  return type === "stamp" || type === "cashback";
}

/** Libellé du compteur d'en-tête : « POINTS 2 / 10 » pour une carte à points. */
export function counterLabel(type: EssaiCardType, labelStamps: string): string {
  if (type === "cashback") return "Points";
  return labelStamps.trim() || "Tampons";
}

/** `#rrggbb` + opacité → `#rrggbbaa` (repli : blanc translucide). */
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : `rgba(255,255,255,${alpha})`;
}

/** Fond du chargement de la bande : dégradé doux à l'accent de la carte. */
function stripLoadingTint(accent: string): string {
  return `linear-gradient(115deg, ${withAlpha(accent, 0.34)} 0%, ${withAlpha(accent, 0.12)} 55%, ${withAlpha(accent, 0.28)} 100%)`;
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(v) ? v : min)));
}

/** Variante légèrement assombrie / éclaircie du fond (zone bande vide). */
function stripShade(bg: string): string {
  return luminance(bg) > 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
}

// ─── Carte Apple Wallet ───────────────────────────────────────────────────

export function AppleWalletPass({ data, pop, busy }: PassProps) {
  const { background, text, accent } = data.colors;
  const dark = luminance(background) < 0.45;
  const counter = hasCounter(data.cardType);
  const total = clampInt(data.stampCount, 1, 99);
  const stamps = clampInt(data.stamps, 0, total);
  const firstName = (data.firstName ?? "").trim();
  const reward = data.rewardText.trim();

  return (
    <div className="w-full" style={{ containerType: "inline-size" }}>
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "680 / 998",
          borderRadius: "3.3cqw",
          backgroundColor: background,
          color: text,
          transition: COLOR_TRANSITION,
          fontFamily: APPLE_FONT,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* En-tête : logo + nom (gauche), compteur (droite). */}
        <div
          className="flex items-center"
          style={{ height: "16.9cqw", paddingLeft: "3.7cqw", paddingRight: "4cqw", gap: "3.3cqw" }}
        >
          <PassLogo url={data.logoUrl} name={data.name} accent={accent} size="11.2cqw" busy={busy?.logo} />
          <span
            className="min-w-0 flex-1 truncate"
            style={{ fontSize: "4.5cqw", fontWeight: 600, letterSpacing: "-0.012em", lineHeight: 1.2 }}
          >
            {data.name}
          </span>
          <span
            className="shrink-0 text-right transition-opacity duration-300"
            style={{ opacity: counter ? 1 : 0 }}
          >
            {counter && (
              <>
                <span className="block" style={appleLabel}>
                  {counterLabel(data.cardType, data.labelStamps)}
                </span>
                <span
                  className="block"
                  style={{
                    fontSize: "4.9cqw",
                    fontWeight: 400,
                    lineHeight: 1.15,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span key={pop?.key ?? 0} className={pop ? styles.countPop : undefined}>
                    {stamps}
                  </span>
                  {" / "}
                  {total}
                </span>
              </>
            )}
          </span>
        </div>

        {/* Bande : image RÉELLE du pass (photo + tampons). */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "375 / 144", backgroundColor: stripShade(background) }}
        >
          <BannerImage
            src={data.bannerUrl}
            fallback={data.photoUrl}
            cardType={data.cardType}
            tint={stripLoadingTint(accent)}
          />
          {pop && data.cardType === "stamp" && (
            <StampBurst
              key={pop.key}
              index={pop.index}
              total={total}
              boxAspect={375 / 144}
              accent={accent}
            />
          )}
          {busy?.strip && <span className={styles.shimmer} aria-hidden />}
        </div>

        {/* Rangée : « Bonjour <prénom> » à gauche, « Notre offre » à droite. */}
        <div
          className="flex items-start justify-between"
          style={{ padding: "2.5cqw 4cqw 0 3.8cqw", gap: "5cqw" }}
        >
          {firstName && (
            <span className="block min-w-0 shrink-0" style={{ maxWidth: "38%" }}>
              <span className="block" style={appleLabel}>
                Bonjour
              </span>
              <span className="block truncate" style={appleValue}>
                {firstName}
              </span>
            </span>
          )}
          <span
            className={cn("relative block min-w-0 flex-1", firstName && "text-right")}
          >
            <span className="block" style={appleLabel}>
              Notre offre
            </span>
            <span className="block truncate" style={appleValue}>
              {reward || " "}
            </span>
            {busy?.reward && <span className={styles.shimmer} aria-hidden />}
          </span>
        </div>

        {/* QR blanc « aswallet ». */}
        <span
          className="absolute block bg-white text-center"
          style={{
            left: "29.05cqw",
            bottom: "3.5cqw",
            width: "41.9cqw",
            borderRadius: "1.6cqw",
            padding: "2.4cqw 0 1.5cqw",
          }}
        >
          <PassQr
            value={data.token}
            style={{ display: "block", width: "34.9cqw", height: "34.9cqw", margin: "0 auto" }}
          />
          <span
            className="block"
            style={{
              marginTop: "0.9cqw",
              fontSize: "3.4cqw",
              lineHeight: 1.2,
              color: "#000",
              whiteSpace: "nowrap",
            }}
          >
            aswallet
          </span>
        </span>

        <Sheen />
        {/* Liseré du pass (visible sur les fonds sombres, comme sur iPhone). */}
        <span
          className="pointer-events-none absolute inset-0 block"
          style={{
            borderRadius: "inherit",
            boxShadow: dark
              ? "inset 0 0 0 0.32cqw rgba(255,255,255,0.24)"
              : "inset 0 0 0 0.2cqw rgba(0,0,0,0.07)",
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}

const appleLabel: CSSProperties = {
  fontSize: "2.9cqw",
  fontWeight: 600,
  lineHeight: 1.25,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const appleValue: CSSProperties = {
  marginTop: "0.6cqw",
  fontSize: "4.6cqw",
  fontWeight: 400,
  lineHeight: 1.25,
  letterSpacing: "-0.005em",
};

// ─── Carte Google Wallet ──────────────────────────────────────────────────

export function GoogleWalletPass({ data, pop, busy }: PassProps) {
  // Google réécrit la couleur du texte (blanc) : même règle de fond que
  // le générateur Google Wallet du serveur, pour un aperçu honnête.
  const background = googleEffectiveBgColor(data.colors.background, data.colors.accent);
  const counter = hasCounter(data.cardType);
  const total = clampInt(data.stampCount, 1, 99);
  const stamps = clampInt(data.stamps, 0, total);
  const firstName = (data.firstName ?? "").trim();
  const reward = data.rewardText.trim();

  return (
    <div className="w-full" style={{ containerType: "inline-size" }}>
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: "5.4cqw",
          backgroundColor: background,
          color: "#ffffff",
          transition: COLOR_TRANSITION,
          fontFamily: GOOGLE_FONT,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={{ padding: "5cqw 5.6cqw 0" }}>
          <div className="flex items-center" style={{ gap: "3cqw" }}>
            <PassLogo
              url={data.logoUrl}
              name={data.name}
              accent={data.colors.accent}
              size="9.6cqw"
              busy={busy?.logo}
            />
            <span
              className="min-w-0 truncate"
              style={{ fontSize: "4.1cqw", fontWeight: 500, letterSpacing: "0.005em" }}
            >
              {data.name}
            </span>
          </div>

          <span
            className="block"
            style={{
              marginTop: "4.8cqw",
              fontSize: "7cqw",
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            {GOOGLE_TITLES[data.cardType]}
          </span>

          {counter && (
            <span className="block" style={{ marginTop: "4.4cqw" }}>
              <span className="block" style={googleLabel}>
                {counterLabel(data.cardType, data.labelStamps)}
              </span>
              <span
                className="block"
                style={{
                  fontSize: "6cqw",
                  fontWeight: 500,
                  lineHeight: 1.2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span key={pop?.key ?? 0} className={pop ? styles.countPop : undefined}>
                  {stamps}
                </span>
                {" / "}
                {total}
              </span>
            </span>
          )}

          <span
            className="flex items-start justify-between"
            style={{ marginTop: "4cqw", gap: "5cqw" }}
          >
            {firstName && (
              <span className="block min-w-0 shrink-0" style={{ maxWidth: "38%" }}>
                <span className="block" style={googleLabel}>
                  Bonjour
                </span>
                <span className="block truncate" style={googleValue}>
                  {firstName}
                </span>
              </span>
            )}
            <span className={cn("relative block min-w-0 flex-1", firstName && "text-right")}>
              <span className="block" style={googleLabel}>
                Notre offre
              </span>
              <span className="block truncate" style={googleValue}>
                {reward || " "}
              </span>
              {busy?.reward && <span className={styles.shimmer} aria-hidden />}
            </span>
          </span>

          <span className="flex flex-col items-center" style={{ padding: "6.4cqw 0 6cqw" }}>
            <span
              className="block bg-white"
              style={{ width: "46cqw", padding: "3.4cqw", borderRadius: "3.8cqw" }}
            >
              <PassQr value={data.token} style={{ display: "block", width: "100%", height: "auto" }} />
            </span>
            <span
              className="block"
              style={{ marginTop: "2.8cqw", fontSize: "3.6cqw", lineHeight: 1.2, opacity: 0.95 }}
            >
              aswallet
            </span>
          </span>
        </div>

        {/* Image principale (bande photo) en bas, comme sur Android. */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "1032 / 336", backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          <BannerImage
            src={data.bannerUrl}
            fallback={data.photoUrl}
            cardType={data.cardType}
            tint={stripLoadingTint(data.colors.accent)}
          />
          {pop && data.cardType === "stamp" && (
            <StampBurst
              key={pop.key}
              index={pop.index}
              total={total}
              boxAspect={1032 / 336}
              accent={data.colors.accent}
            />
          )}
          {busy?.strip && <span className={styles.shimmer} aria-hidden />}
        </div>

        <Sheen />
      </div>
    </div>
  );
}

const googleLabel: CSSProperties = {
  fontSize: "3.3cqw",
  fontWeight: 400,
  lineHeight: 1.3,
  opacity: 0.8,
  whiteSpace: "nowrap",
};

const googleValue: CSSProperties = {
  marginTop: "0.5cqw",
  fontSize: "4.4cqw",
  fontWeight: 500,
  lineHeight: 1.3,
};

// ─── Éléments communs ─────────────────────────────────────────────────────

function Sheen() {
  return (
    <span className={styles.sheen} aria-hidden>
      <span className={styles.holo} />
      <span className={styles.glare} />
      <span className={styles.sweep} />
    </span>
  );
}

function PassLogo({
  url,
  name,
  accent,
  size,
  busy,
}: {
  url: string | null;
  name: string;
  accent: string;
  size: string;
  busy?: boolean;
}) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && brokenUrl !== url;
  const initial = (name.trim().charAt(0) || "A").toUpperCase();

  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL dynamique (Supabase), pas d'optimisation utile.
        <img
          src={url as string}
          alt=""
          draggable={false}
          className="block h-full w-full object-cover"
          onError={() => setBrokenUrl(url)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-bold"
          style={{
            backgroundColor: accent,
            color: pickContrast(accent),
            fontSize: `calc(${size} * 0.46)`,
            transition: COLOR_TRANSITION,
          }}
        >
          {initial}
        </span>
      )}
      {busy && <span className={styles.shimmer} aria-hidden />}
    </span>
  );
}

/** QR code dessiné en SVG (synchrone, net à toute taille). */
function PassQr({ value, style }: { value: string; style?: CSSProperties }) {
  const qr = useMemo(() => {
    try {
      const code = QRCode.create(value || "aswallet", { errorCorrectionLevel: "M" });
      const size = code.modules.size;
      let d = "";
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (code.modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`;
        }
      }
      return { size, d };
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) return <span style={style} />;
  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      style={style}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
    >
      <path d={qr.d} fill="#000" />
    </svg>
  );
}

// ─── Bande : fondu enchaîné entre deux versions ───────────────────────────

interface BannerLayer {
  url: string;
  ready: boolean;
}

/** Type rendu par une URL de bande (`?kind=`) ; `null` pour une photo seule. */
function bannerKindOf(url: string): string | null {
  try {
    return new URL(url, "https://aswallet.invalid").searchParams.get("kind");
  } catch {
    return null;
  }
}

/**
 * Affiche l'image de la bande ; à chaque nouvelle URL, la nouvelle version
 * est posée PAR-DESSUS l'ancienne et apparaît en fondu une fois chargée
 * (aucun « trou » blanc entre deux versions). En cas d'échec : photo seule,
 * puis simple fond — jamais de message d'erreur.
 *
 * Changement de type : la bande de l'ancien type (ex. tampons) disparaît
 * AUSSITÔT ; un chargement aux couleurs de la carte (`tint` + miroitement)
 * la remplace jusqu'à ce que la bande du nouveau type soit chargée, qui
 * apparaît alors en fondu.
 */
function BannerImage({
  src,
  fallback,
  cardType,
  tint,
}: {
  src: string | null;
  fallback: string | null;
  cardType: EssaiCardType;
  /** Fond du chargement (dégradé aux couleurs de la carte). */
  tint: string;
}) {
  // Bande rendue pour un autre type (retouche pas encore confirmée par le
  // serveur) : jamais affichée.
  const isStale = (url: string) => {
    const kind = bannerKindOf(url);
    return kind !== null && kind !== cardType;
  };

  const [failed, setFailed] = useState<readonly string[]>([]);
  const wanted =
    src && !failed.includes(src)
      ? isStale(src)
        ? null
        : src
      : fallback && !failed.includes(fallback)
        ? fallback
        : null;

  const [layers, setLayers] = useState<BannerLayer[]>(() =>
    wanted ? [{ url: wanted, ready: false }] : []
  );
  const [prevWanted, setPrevWanted] = useState(wanted);
  if (wanted !== prevWanted) {
    // Mise à jour d'état dérivée pendant le rendu (motif React documenté).
    setPrevWanted(wanted);
    if (wanted) {
      setLayers((current) => [
        ...current.filter((l) => l.ready && l.url !== wanted && !isStale(l.url)).slice(-1),
        { url: wanted, ready: false },
      ]);
    }
  }

  const visible = layers.filter((l) => !isStale(l.url));
  // Une bande du bon type est affichée : le chargement s'efface derrière
  // elle (après son fondu), sinon il est visible tout de suite.
  const covered = visible.some((l) => l.ready);

  const markReady = (url: string) =>
    setLayers((current) =>
      current.some((l) => l.url === url && !l.ready)
        ? current.map((l) => (l.url === url ? { ...l, ready: true } : l))
        : current
    );
  const markFailed = (url: string) => {
    setFailed((list) => (list.includes(url) ? list : [...list, url]));
    setLayers((current) => current.filter((l) => l.url !== url));
  };
  /** Le calque du dessus est entièrement visible : on retire ceux du dessous. */
  const pruneBelow = (url: string) =>
    setLayers((current) => {
      const index = current.findIndex((l) => l.url === url);
      return index > 0 && index === current.length - 1 ? current.slice(index) : current;
    });

  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0 block"
        style={{
          background: tint,
          opacity: covered ? 0 : 1,
          visibility: covered ? "hidden" : "visible",
          transition: covered
            ? "opacity 260ms ease 420ms, visibility 0s linear 680ms"
            : "none",
        }}
      >
        <span className={styles.shimmer} />
      </span>
      {visible.map((layer) => (
        // eslint-disable-next-line @next/next/no-img-element -- image générée à la volée, fondu maîtrisé à la main.
        <img
          key={layer.url}
          src={layer.url}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(styles.bannerLayer, layer.ready && styles.bannerLayerReady)}
          ref={(node) => {
            // Image déjà chargée avant l'hydratation : onLoad ne viendra pas.
            if (node && !layer.ready && node.complete && node.naturalWidth > 0) {
              markReady(layer.url);
            }
          }}
          onLoad={() => markReady(layer.url)}
          onError={() => markFailed(layer.url)}
          onTransitionEnd={() => pruneBelow(layer.url)}
        />
      ))}
    </>
  );
}

// ─── « Pop » du tampon ajouté ─────────────────────────────────────────────

/** Même grille que /api/wallet/banner (source de vérité du rendu). */
const BANNER_W = 1125;
const BANNER_H = 369;

function pickGrid(total: number): { cols: number; rows: number } {
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

/**
 * Centre et taille du tampon `index` dans la bande affichée (en % de la
 * boîte), en tenant compte du recadrage centré (object-fit: cover).
 */
function stampSpot(index: number, total: number, boxAspect: number) {
  const n = clampInt(total, 1, 20);
  const { cols, rows } = pickGrid(n);
  const dense = n >= 12;
  const padding = dense ? 64 : 36;
  const gap = dense ? 14 : 22;
  const maxByW = (BANNER_W - padding * 2 - gap * (cols - 1)) / cols;
  const maxByH = (BANNER_H - padding * 2 - gap * (rows - 1)) / rows;
  const cap = rows === 1 ? 130 : rows === 2 ? 120 : 100;
  const size = Math.max(48, Math.min(cap, Math.floor(Math.min(maxByW, maxByH))));

  const i = clampInt(index, 0, n - 1);
  const row = Math.floor(i / cols);
  const col = i % cols;
  const inRow = row === rows - 1 ? n - row * cols : cols;
  const x = BANNER_W / 2 + (col - (inRow - 1) / 2) * (size + gap);
  const y = BANNER_H / 2 + (row - (rows - 1) / 2) * (size + gap);

  // Boîte de hauteur 1 et de largeur boxAspect.
  const scale = Math.max(boxAspect / BANNER_W, 1 / BANNER_H);
  const offX = (boxAspect - BANNER_W * scale) / 2;
  const offY = (1 - BANNER_H * scale) / 2;
  return {
    left: `${(((x * scale + offX) / boxAspect) * 100).toFixed(3)}%`,
    top: `${((y * scale + offY) * 100).toFixed(3)}%`,
    width: `${(((size * scale) / boxAspect) * 100).toFixed(3)}%`,
    height: `${(size * scale * 100).toFixed(3)}%`,
  };
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function StampBurst({
  index,
  total,
  boxAspect,
  accent,
}: {
  index: number;
  total: number;
  boxAspect: number;
  accent: string;
}) {
  const spot = stampSpot(index, total, boxAspect);
  return (
    <span className={styles.burst} style={spot} aria-hidden>
      <span className={styles.burstGlow} />
      <span className={styles.burstRing} />
      {SPARK_ANGLES.map((a, i) => (
        <span
          key={a}
          className={styles.burstSpark}
          style={
            {
              "--a": `${a + 22}deg`,
              background: i % 2 === 0 ? "#ffffff" : accent,
              animationDelay: `${i % 2 === 0 ? 0 : 40}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
