import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

export const runtime = "nodejs";

// Google Wallet heroImage 3:1, Apple Wallet strip 3:1 (we reuse same endpoint).
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

// Clip a stamp container to a recognizable shape via border-radius. Satori
// supports border-radius as %.
function shapeRadius(shape: string): string {
  switch (shape) {
    case "squircle":
      return "30%";
    case "shield":
    case "hex":
      return "20%"; // approximated; true polygons aren't reliably renderable in Satori
    case "star":
      return "50%"; // we'll add a halo to evoke a "star" feel in fallback
    case "circle":
    default:
      return "50%";
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
    const stampActiveUrl =
      (design.stamp_active_url as string | null) ||
      (design.activeImageUrl as string | null) ||
      null;
    const stampInactiveUrl =
      (design.stamp_inactive_url as string | null) ||
      (design.inactiveImageUrl as string | null) ||
      null;
    const shape =
      (design.stamp_shape as string) ||
      (design.stamp_active_icon === "square" ? "squircle" : "circle");
    const radius = shapeRadius(shape);
    const businessName = card.businesses?.name ?? "Commerce";
    const cardName = card.name ?? "Carte de fidélité";

    const stampsTotal = Math.max(1, Math.min(20, card.stamp_count));
    const stampsCollected = Math.max(
      0,
      Math.min(instance.stamps_collected, stampsTotal),
    );

    const { cols, rows } = pickGrid(stampsTotal);

    // Compute stamp size to fit perfectly in right panel.
    const rightPanelW = Math.floor(WIDTH * 0.6);
    const padding = 28;
    const gap = 14;
    const maxByW = (rightPanelW - padding * 2 - gap * (cols - 1)) / cols;
    const maxByH = (HEIGHT - padding * 2 - gap * (rows - 1)) / rows;
    const stampSize = Math.max(36, Math.min(86, Math.floor(Math.min(maxByW, maxByH))));
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
            flexDirection: "row",
            background: `linear-gradient(135deg, ${accent} 0%, ${darken(accent, 0.25)} 100%)`,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "white",
          }}
        >
          {/* LEFT PANEL: 40% — branding */}
          <div
            style={{
              width: `${WIDTH * 0.4}px`,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "28px 32px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 18,
                color: "rgba(255,255,255,0.78)",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                fontWeight: 600,
              }}
            >
              {truncate(businessName, 28)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 38,
                fontWeight: 800,
                lineHeight: 1.1,
                marginBottom: 14,
              }}
            >
              {truncate(cardName, 30)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 16,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.35,
              }}
            >
              {truncate(card.reward_text ?? "", 60)}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "auto",
                fontSize: 22,
                fontWeight: 700,
                color: "white",
              }}
            >
              {stampsCollected} / {stampsTotal} tampons
            </div>
          </div>

          {/* RIGHT PANEL: 60% — stamps grid */}
          <div
            style={{
              width: `${WIDTH * 0.6}px`,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: `${padding}px`,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: `${gap}px`,
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
                    radius,
                    accent,
                    activeUrl: stampActiveUrl,
                    inactiveUrl: stampInactiveUrl,
                    iconGlyph: pickIcon(design, s.filled),
                    key: s.idx,
                  }))}
                </div>
              ))}
            </div>
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
  radius: string;
  accent: string;
  activeUrl: string | null;
  inactiveUrl: string | null;
  iconGlyph: string;
  key: number;
}

function renderStamp(p: StampProps) {
  const url = p.filled ? p.activeUrl : p.inactiveUrl;
  if (url) {
    return (
      <div
        key={p.key}
        style={{
          width: `${p.size}px`,
          height: `${p.size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: p.filled ? 1 : 0.35,
          borderRadius: p.radius,
          overflow: "hidden",
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
  return (
    <div
      key={p.key}
      style={{
        width: `${p.size}px`,
        height: `${p.size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: p.filled ? "#ffffff" : "rgba(255,255,255,0.10)",
        border: p.filled ? "none" : "2.5px solid rgba(255,255,255,0.55)",
        borderRadius: p.radius,
        boxShadow: p.filled ? "0 4px 12px rgba(0,0,0,0.18)" : "none",
        color: p.filled ? p.accent : "rgba(255,255,255,0.85)",
        fontSize: `${p.iconFontSize}px`,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {p.iconGlyph}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
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
