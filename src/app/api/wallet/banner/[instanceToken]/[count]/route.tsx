import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

export const runtime = "nodejs";

// Image utilisée à la fois pour Apple Wallet (strip image) et Google Wallet
// (heroImage). Ratio ~3:1. On NE rend QUE la grille de tampons, centrée, sur
// fond accent_color. Aucun texte, aucun nom de commerce, aucun compteur.
// Toutes les autres infos (logo commerce, points, prochaine récompense...) sont
// rendues par le wallet lui-même via les fields du pass.json.
const WIDTH = 1032;
const HEIGHT = 336;

// Map of icon keys -> emoji (rendered via Twemoji-friendly font fallback in Satori).
// These read clean as glyphs in `system-ui` and most rendering pipelines support
// them out of the box. No nested <svg> needed → much more robust in Satori.
const ICON_GLYPH: Record<string, string> = {
  check: "✓",
  star: "★",
  heart: "♥",
  coffee: "☕",
  pizza: "🍕",
  flower: "✿",
  scissors: "✂",
  crown: "♛",
  leaf: "❦",
  gift: "🎁",
  baguette: "🥖",
  kebab: "🥙",
  diamond: "♦",
  sparkle: "✦",
  circle: "●",
  square: "■",
};

function pickIcon(design: Record<string, unknown>, filled: boolean): string {
  // Field naming has evolved in DB — accept all variants.
  const key = filled
    ? (design.stamp_active_icon as string) ??
      (design.stamp_icon as string) ??
      "check"
    : (design.stamp_inactive_icon as string) ??
      (design.stamp_icon as string) ??
      "circle";
  return ICON_GLYPH[key] ?? (filled ? "✓" : "●");
}

type StampShape = "circle" | "squircle" | "shield" | "star" | "hex";

function normalizeShape(s: unknown): StampShape {
  const valid: StampShape[] = ["circle", "squircle", "shield", "star", "hex"];
  return typeof s === "string" && (valid as string[]).includes(s)
    ? (s as StampShape)
    : "circle";
}

// Renvoie un <svg> top-level avec la forme demandée (path/circle/rect/polygon).
// Pas de SVG nested, pas de clip-path — pur path SVG, supporté par Satori.
function ShapeSvg({
  shape,
  size,
  fill,
  stroke,
  strokeWidth,
}: {
  shape: StampShape;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const sw = strokeWidth;
  switch (shape) {
    case "squircle":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "flex" }}>
          <rect
            x={2}
            y={2}
            width={44}
            height={44}
            rx={12}
            ry={12}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );
    case "shield":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "flex" }}>
          <path
            d="M24 3 L43 9 V24 C43 34 34 42 24 45 C14 42 5 34 5 24 V9 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "flex" }}>
          <path
            d="M24 3 L29.5 18.5 L45.5 19 L32.8 29 L37.5 44.5 L24 35 L10.5 44.5 L15.2 29 L2.5 19 L18.5 18.5 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "hex":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "flex" }}>
          <polygon
            points="24,3 43,13.5 43,34.5 24,45 5,34.5 5,13.5"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "circle":
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "flex" }}>
          <circle
            cx={24}
            cy={24}
            r={22}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );
  }
}

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

function errorImage(message: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1f2937",
          color: "white",
          fontSize: 36,
          fontFamily: "system-ui",
        }}
      >
        {message}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Content-Type": "image/png",
      },
    },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ instanceToken: string; count: string }> },
) {
  try {
    const { instanceToken } = await params;
    const supabase = createAdminClient();

    const { data: instance, error } = await supabase
      .from("card_instances")
      .select(
        `stamps_collected,
         cards(name, stamp_count, reward_text, design, businesses(name))`,
      )
      .eq("token", instanceToken)
      .single();

    if (error || !instance) return errorImage("Carte introuvable");

    const card = instance.cards as unknown as {
      name: string;
      stamp_count: number;
      reward_text: string | null;
      design: Record<string, unknown> | null;
      businesses: { name: string } | null;
    };

    const design: Record<string, unknown> = {
      ...DEFAULT_CARD_DESIGN,
      ...(card.design ?? {}),
    };

    // Visual config — accept multiple field naming conventions for forward compat.
    const accent = (design.accent_color as string) || "#10b981";
    const background =
      (design.background_color as string) || darken(accent, 0.0);
    const bannerUrl = (design.banner_url as string | null) || null;
    const stampActiveUrl =
      (design.stamp_active_url as string | null) ||
      (design.activeImageUrl as string | null) ||
      null;
    const stampInactiveUrl =
      (design.stamp_inactive_url as string | null) ||
      (design.inactiveImageUrl as string | null) ||
      null;
    const shape = normalizeShape(design.stamp_shape);

    const stampsTotal = Math.max(1, Math.min(20, card.stamp_count));
    const stampsCollected = Math.max(
      0,
      Math.min(instance.stamps_collected, stampsTotal),
    );

    const { cols, rows } = pickGrid(stampsTotal);

    // La grille occupe maintenant la TOTALITÉ de l'image. Pas de panneau gauche.
    // On laisse une marge confortable pour respirer (Apple/Google rajoutent
    // ensuite leurs propres champs autour).
    // Tampons gros et blancs comme Boomerangme : on accepte d'aller jusqu'à
    // 200px pour qu'ils dominent le strip, comme dans la capture KFC/Boomerang.
    const padding = 28;
    const gap = 18;
    const maxByW = (WIDTH - padding * 2 - gap * (cols - 1)) / cols;
    const maxByH = (HEIGHT - padding * 2 - gap * (rows - 1)) / rows;
    const stampSize = Math.max(60, Math.min(200, Math.floor(Math.min(maxByW, maxByH))));
    const iconFontSize = Math.floor(stampSize * 0.55);

    const stamps: Array<{ filled: boolean; idx: number }> = [];
    for (let i = 0; i < stampsTotal; i++) {
      stamps.push({ filled: i < stampsCollected, idx: i });
    }
    const rowsArr: typeof stamps[] = [];
    for (let r = 0; r < rows; r++) {
      rowsArr.push(stamps.slice(r * cols, (r + 1) * cols));
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Banner photo si le merchant l'a uploadée. Sinon, un fond uni en
            // background_color (la couleur de fond choisie par le merchant
            // dans le designer) avec un léger gradient pour la profondeur.
            backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: bannerUrl ? "transparent" : background,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "white",
            padding: `${padding}px`,
            position: "relative",
          }}
        >
          {/* Overlay : sombre si photo (lisibilité), discret sinon */}
          {bannerUrl && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                backgroundImage:
                  "linear-gradient(135deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.45) 100%)",
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
                {row.map((s) => renderStamp({
                  filled: s.filled,
                  size: stampSize,
                  iconFontSize,
                  shape,
                  accent,
                  activeUrl: stampActiveUrl,
                  inactiveUrl: stampInactiveUrl,
                  iconGlyph: pickIcon(design, s.filled),
                  key: s.idx,
                }))}
              </div>
            ))}
          </div>

          {/* Footer "Powered by aswallet" — style Boomerangme */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 14,
              display: "flex",
              fontSize: 13,
              color: bannerUrl ? "rgba(255,255,255,0.85)" : pickFooterColor(background),
              fontWeight: 500,
              letterSpacing: 0.3,
              zIndex: 2,
            }}
          >
            Powered by aswallet
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300",
          "Content-Type": "image/png",
        },
      },
    );
  } catch (err) {
    console.error("[wallet-banner] error:", err);
    return errorImage("Erreur de rendu");
  }
}

interface StampProps {
  filled: boolean;
  size: number;
  iconFontSize: number;
  shape: StampShape;
  accent: string;
  activeUrl: string | null;
  inactiveUrl: string | null;
  iconGlyph: string;
  key: number;
}

function renderStamp(p: StampProps) {
  const url = p.filled ? p.activeUrl : p.inactiveUrl;
  if (url) {
    // Image custom uploadée par le merchant — on garde le ratio sans masquage,
    // mais on respecte la shape via border-radius (compromis pratique).
    const radiusForImg =
      p.shape === "circle" ? "50%" : p.shape === "squircle" ? "30%" : "12%";
    return (
      <div
        key={p.key}
        style={{
          width: `${p.size}px`,
          height: `${p.size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: p.filled ? 1 : 0.6,
          borderRadius: radiusForImg,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
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

  // Style Boomerangme avec VRAIE forme SVG (star, shield, hex, etc.) au lieu
  // d'un simple rond avec border-radius. Le SVG porte la forme + le fond
  // blanc, on superpose le glyphe icône au centre via un span absolu.
  const fill = "#ffffff";
  const stroke = p.filled ? p.accent : "rgba(255,255,255,0.55)";
  const strokeWidth = p.filled ? 1.2 : 2;
  const iconColor = p.filled ? p.accent : "#9ca3af";
  return (
    <div
      key={p.key}
      style={{
        width: `${p.size}px`,
        height: `${p.size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <ShapeSvg
        shape={p.shape}
        size={p.size}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${p.size}px`,
          height: `${p.size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
          fontSize: `${p.iconFontSize}px`,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {p.iconGlyph}
      </div>
    </div>
  );
}

// Choisit une couleur de footer lisible selon la luminance du fond.
// Fond clair -> texte foncé ; fond sombre -> texte clair.
function pickFooterColor(bgHex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((bgHex ?? "").trim());
  if (!m) return "rgba(255,255,255,0.85)";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)";
}

// Darken a hex color by a fraction (0..1).
function darken(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = f(parseInt(m[1], 16));
  const g = f(parseInt(m[2], 16));
  const b = f(parseInt(m[3], 16));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
