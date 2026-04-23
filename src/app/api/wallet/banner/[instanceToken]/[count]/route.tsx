import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

// Google Wallet heroImage ~3:1 recommendation
const WIDTH = 1032;
const HEIGHT = 336;

type StampShape = "circle" | "squircle" | "shield" | "star" | "hex";
type StampIconKey =
  | "check" | "star" | "heart" | "coffee" | "pizza" | "flower"
  | "scissors" | "crown" | "leaf" | "gift" | "baguette" | "kebab"
  | "diamond" | "sparkle";

// Pick a nice grid layout for a given total.
function pickGrid(total: number): { cols: number; rows: number } {
  const table: Record<number, { cols: number; rows: number }> = {
    6: { cols: 3, rows: 2 },
    8: { cols: 4, rows: 2 },
    10: { cols: 5, rows: 2 },
    12: { cols: 6, rows: 2 },
    15: { cols: 5, rows: 3 },
    20: { cols: 5, rows: 4 },
  };
  if (table[total]) return table[total];
  if (total <= 5) return { cols: total, rows: 1 };
  if (total <= 20) {
    const rows = 2;
    const cols = Math.ceil(total / rows);
    return { cols, rows };
  }
  const rows = Math.ceil(total / 5);
  return { cols: 5, rows };
}

// SVG path for each supported shape in a 48x48 viewbox.
function shapeElement(shape: StampShape, stroke: string, fill: string, strokeW: number) {
  const common = { stroke, fill, strokeWidth: strokeW, strokeLinejoin: "round" as const };
  switch (shape) {
    case "squircle":
      return <rect x="3" y="3" width="42" height="42" rx="12" ry="12" {...common} />;
    case "shield":
      // Shield: top flat, curved bottom.
      return (
        <path
          d="M24 3 L43 9 V24 C43 34 34 42 24 45 C14 42 5 34 5 24 V9 Z"
          {...common}
        />
      );
    case "star":
      // 5-point star inscribed in 48x48.
      return (
        <path
          d="M24 3 L29.5 18.5 L45.5 19 L32.8 29 L37.5 44.5 L24 35 L10.5 44.5 L15.2 29 L2.5 19 L18.5 18.5 Z"
          {...common}
        />
      );
    case "hex":
      // Flat-top hexagon.
      return (
        <polygon
          points="24,3 43,13.5 43,34.5 24,45 5,34.5 5,13.5"
          {...common}
        />
      );
    case "circle":
    default:
      return <circle cx="24" cy="24" r="21" {...common} />;
  }
}

// Inlined icon SVG children for 14 keys. Each icon is authored for a 24x24
// viewbox; we render them inside a 24x24 <svg> nested on top of the shape.
// `color` here is passed as explicit stroke/fill - no `currentColor` because
// Satori does not always resolve it reliably.
function iconChildren(key: StampIconKey, color: string) {
  switch (key) {
    case "check":
      return (
        <path
          d="M5 13l4 4L19 7"
          stroke={color}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case "star":
      return (
        <path
          d="M12 2.5l2.95 6.15 6.8.78-5 4.77 1.32 6.7L12 17.6l-6.07 3.3L7.25 14.2l-5-4.77 6.8-.78L12 2.5z"
          fill={color}
        />
      );
    case "heart":
      return (
        <path
          d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 3.2C19.5 16.1 12 20.5 12 20.5z"
          fill={color}
        />
      );
    case "coffee":
      return (
        <>
          <path
            d="M17 8h1a4 4 0 0 1 0 8h-1"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M6 2v2M10 2v2M14 2v2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case "pizza":
      return (
        <>
          <path
            d="M12 2a10 10 0 0 1 8.66 5L12 22 3.34 7A10 10 0 0 1 12 2zm0 2a8 8 0 0 0-6.56 3.43L12 18.55 18.56 7.43A8 8 0 0 0 12 4z"
            fill={color}
          />
          <circle cx="9" cy="10" r="1.1" fill={color} />
          <circle cx="13.5" cy="9" r="1.1" fill={color} />
          <circle cx="11.5" cy="14" r="1.1" fill={color} />
        </>
      );
    case "flower":
      return (
        <>
          <circle cx="12" cy="12" r="2.2" fill={color} />
          <path
            d="M12 2a3.3 3.3 0 0 1 3 4.8c1.8-.3 3.5 1.4 3.2 3.2A3.3 3.3 0 0 1 22 12a3.3 3.3 0 0 1-3.8 2c.3 1.8-1.4 3.5-3.2 3.2A3.3 3.3 0 0 1 12 22a3.3 3.3 0 0 1-3-4.8c-1.8.3-3.5-1.4-3.2-3.2A3.3 3.3 0 0 1 2 12a3.3 3.3 0 0 1 3.8-2C5.5 8.2 7.2 6.5 9 6.8A3.3 3.3 0 0 1 12 2z"
            fill={color}
          />
        </>
      );
    case "scissors":
      return (
        <>
          <circle cx="6" cy="6" r="3" fill="none" stroke={color} strokeWidth={2} />
          <circle cx="6" cy="18" r="3" fill="none" stroke={color} strokeWidth={2} />
          <path
            d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case "crown":
      return (
        <path
          d="M2 18l2-10 5 4 3-7 3 7 5-4 2 10H2zm0 2h20v2H2v-2z"
          fill={color}
        />
      );
    case "leaf":
      return (
        <path
          d="M20 3c-7 0-13 4-13 11 0 2 .6 3.8 1.6 5.3L5 22l1.4 1.4 3.3-3.3C11 21 12.7 21.5 14.5 21.5 19 21.5 21 16 21 10c0-3 .4-5.7-1-7zM9 16c0-5 4-9 9-9-1 6-5 9-9 9z"
          fill={color}
        />
      );
    case "gift":
      return (
        <>
          <path
            d="M20 12v10H4V12"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M2 7h20v5H2z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M12 22V7"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case "baguette":
      return (
        <path
          d="M18.5 3c1.5 0 2.5 1 2.5 2.5 0 .8-.3 1.3-.9 1.9L7.4 20.1c-.6.6-1.1.9-1.9.9C4 21 3 20 3 18.5c0-.8.3-1.3.9-1.9L16.6 3.9c.6-.6 1.1-.9 1.9-.9z"
          fill={color}
        />
      );
    case "kebab":
      return (
        <>
          <rect x="3" y="11" width="18" height="3" rx="1.5" fill={color} />
          <circle cx="6.5" cy="7.5" r="2.5" fill={color} />
          <circle cx="12" cy="6.5" r="3" fill={color} />
          <circle cx="17.5" cy="7.5" r="2.5" fill={color} />
          <circle cx="7" cy="17" r="2" fill={color} />
          <circle cx="12.5" cy="18" r="2" fill={color} />
          <circle cx="17.5" cy="17" r="2" fill={color} />
        </>
      );
    case "diamond":
      return (
        <path
          d="M6 3h12l4 6-10 12L2 9l4-6zm1.3 2L4.8 8.6 12 17l7.2-8.4L16.7 5H7.3z"
          fill={color}
        />
      );
    case "sparkle":
      return (
        <path
          d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z"
          fill={color}
        />
      );
    default:
      return (
        <path
          d="M5 13l4 4L19 7"
          stroke={color}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
  }
}

function normalizeIconKey(k: unknown): StampIconKey {
  const valid: StampIconKey[] = [
    "check", "star", "heart", "coffee", "pizza", "flower",
    "scissors", "crown", "leaf", "gift", "baguette", "kebab",
    "diamond", "sparkle",
  ];
  return typeof k === "string" && (valid as string[]).includes(k)
    ? (k as StampIconKey)
    : "check";
}

function normalizeShape(s: unknown): StampShape {
  const valid: StampShape[] = ["circle", "squircle", "shield", "star", "hex"];
  return typeof s === "string" && (valid as string[]).includes(s)
    ? (s as StampShape)
    : "circle";
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
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {message}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      status: 404,
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

    // Lean query: only fields actually used for rendering.
    const { data: instance, error } = await supabase
      .from("card_instances")
      .select(
        `
        stamps_collected,
        cards(name, stamp_count, reward_text, design, businesses(name))
      `,
      )
      .eq("token", instanceToken)
      .single();

    if (error || !instance) {
      return errorImage("Carte introuvable");
    }

    const card = instance.cards as unknown as {
      name: string;
      stamp_count: number;
      reward_text: string;
      design: Record<string, unknown> | null;
      businesses: { name: string } | null;
    };

    const design = { ...DEFAULT_CARD_DESIGN, ...(card.design ?? {}) } as Record<string, unknown>;
    const accent = (design.accent_color as string) || "#10b981";
    const bannerUrl = (design.banner_url as string | null) || null;
    const stampActiveUrl =
      (design.stamp_active_url as string | null) ||
      (design["activeImageUrl"] as string | null) ||
      null;
    const stampInactiveUrl =
      (design.stamp_inactive_url as string | null) ||
      (design["inactiveImageUrl"] as string | null) ||
      null;
    const iconKey = normalizeIconKey(design.stamp_icon);
    const shape = normalizeShape(design.stamp_shape);

    const businessName = card.businesses?.name ?? "Commerce";
    const cardName = card.name;
    const rewardText = card.reward_text;

    // DB is source of truth - URL count is only a cache buster.
    const stampsCollected = Math.max(
      0,
      Math.min(instance.stamps_collected, card.stamp_count),
    );
    const stampsTotal = Math.max(1, card.stamp_count);

    const { cols, rows } = pickGrid(stampsTotal);

    // Size each stamp to fit in right panel.
    const rightWidth = WIDTH * 0.6;
    const rightHeight = HEIGHT;
    const gap = 12;
    const padding = 24;
    const maxW = (rightWidth - padding * 2 - gap * (cols - 1)) / cols;
    const maxH = (rightHeight - padding * 2 - gap * (rows - 1)) / rows;
    const stampSize = Math.max(
      28,
      Math.min(80, Math.floor(Math.min(maxW, maxH))),
    );
    const iconSize = Math.floor(stampSize * 0.5);

    const stamps: Array<{ filled: boolean; key: number }> = [];
    for (let i = 0; i < stampsTotal; i++) {
      stamps.push({ filled: i < stampsCollected, key: i });
    }

    // If banner image is present we darken the whole thing for legibility.
    const useBannerBg = Boolean(bannerUrl);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            backgroundColor: accent,
            backgroundImage: useBannerBg ? `url(${bannerUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Dark / gradient overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              backgroundImage: useBannerBg
                ? "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.55) 100%)"
                : "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 100%)",
            }}
          />

          {/* Left 40% */}
          <div
            style={{
              width: `${WIDTH * 0.4}px`,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "32px 28px",
              color: "white",
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: 20,
                color: "rgba(255,255,255,0.8)",
                marginBottom: 8,
                letterSpacing: 0.5,
              }}
            >
              {businessName}
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1.1,
                marginBottom: 14,
                color: "white",
              }}
            >
              {cardName}
            </div>
            <div
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.3,
              }}
            >
              {rewardText}
            </div>
          </div>

          {/* Right 60%: stamp grid */}
          <div
            style={{
              width: `${WIDTH * 0.6}px`,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: `${padding}px`,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: `${gap}px`,
              }}
            >
              {Array.from({ length: rows }).map((_, rowIdx) => (
                <div
                  key={rowIdx}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: `${gap}px`,
                    justifyContent: "center",
                  }}
                >
                  {stamps
                    .slice(rowIdx * cols, rowIdx * cols + cols)
                    .map((s) => {
                      const imgUrl = s.filled ? stampActiveUrl : stampInactiveUrl;
                      if (imgUrl) {
                        return (
                          <div
                            key={s.key}
                            style={{
                              width: `${stampSize}px`,
                              height: `${stampSize}px`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: s.filled ? 1 : 0.45,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt=""
                              width={stampSize}
                              height={stampSize}
                              style={{
                                width: `${stampSize}px`,
                                height: `${stampSize}px`,
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        );
                      }
                      // Shape + icon rendering.
                      const shapeStroke = "rgba(255,255,255,0.95)";
                      const shapeFill = s.filled ? "#ffffff" : "rgba(255,255,255,0.06)";
                      const iconColor = s.filled ? accent : "rgba(255,255,255,0.85)";
                      const iconOffset = (stampSize - iconSize) / 2;
                      return (
                        <div
                          key={s.key}
                          style={{
                            width: `${stampSize}px`,
                            height: `${stampSize}px`,
                            display: "flex",
                            position: "relative",
                          }}
                        >
                          <svg
                            width={stampSize}
                            height={stampSize}
                            viewBox="0 0 48 48"
                            style={{ position: "absolute", top: 0, left: 0 }}
                          >
                            {shapeElement(shape, shapeStroke, shapeFill, 2.2)}
                          </svg>
                          <svg
                            width={iconSize}
                            height={iconSize}
                            viewBox="0 0 24 24"
                            style={{
                              position: "absolute",
                              top: `${iconOffset}px`,
                              left: `${iconOffset}px`,
                            }}
                          >
                            {iconChildren(iconKey, iconColor)}
                          </svg>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom-right counter */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              right: 24,
              display: "flex",
              fontSize: 20,
              fontWeight: 600,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: 0.4,
            }}
          >
            {stampsCollected} / {stampsTotal} tampons
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
    console.error("GET /api/wallet/banner error:", err);
    return errorImage("Erreur");
  }
}
