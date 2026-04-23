import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

// Google Wallet heroImage ~3:1 recommendation
const WIDTH = 1032;
const HEIGHT = 336;

// Pick a grid shape (cols x rows) that fits `total` circles nicely.
// Prefer 2 rows for 6-20, 1 row for <=5, 3 rows for >20.
function pickGrid(total: number): { cols: number; rows: number } {
  if (total <= 5) return { cols: total, rows: 1 };
  if (total <= 20) {
    const rows = 2;
    const cols = Math.ceil(total / rows);
    return { cols, rows };
  }
  const rows = 3;
  const cols = Math.ceil(total / rows);
  return { cols, rows };
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

    const { data: instance, error } = await supabase
      .from("card_instances")
      .select(
        `
        id, token, stamps_collected, rewards_available, status,
        cards(id, name, stamp_count, reward_text, design, businesses(name, logo_url))
      `,
      )
      .eq("token", instanceToken)
      .single();

    if (error || !instance) {
      return errorImage("Carte introuvable");
    }

    const card = instance.cards as unknown as {
      id: string;
      name: string;
      stamp_count: number;
      reward_text: string;
      design: Record<string, unknown> | null;
      businesses: { name: string; logo_url: string | null } | null;
    };

    const design = { ...DEFAULT_CARD_DESIGN, ...(card.design ?? {}) };
    const accent = (design.accent_color as string) || "#10b981";
    const businessName = card.businesses?.name ?? "Commerce";
    const cardName = card.name;
    const rewardText = card.reward_text;
    // Trust DB, never the URL counter (which is only a cache buster).
    const stampsCollected = Math.max(
      0,
      Math.min(instance.stamps_collected, card.stamp_count),
    );
    const stampsTotal = Math.max(1, card.stamp_count);

    const { cols, rows } = pickGrid(stampsTotal);

    // Circle sizing: fit cols x rows into right panel (~60% of width).
    const rightWidth = WIDTH * 0.6;
    const rightHeight = HEIGHT;
    const gap = 12;
    const padding = 24;
    const maxCircleW = (rightWidth - padding * 2 - gap * (cols - 1)) / cols;
    const maxCircleH = (rightHeight - padding * 2 - gap * (rows - 1)) / rows;
    const circleSize = Math.max(
      24,
      Math.min(72, Math.floor(Math.min(maxCircleW, maxCircleH))),
    );

    const circles: Array<{ filled: boolean; key: number }> = [];
    for (let i = 0; i < stampsTotal; i++) {
      circles.push({ filled: i < stampsCollected, key: i });
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            backgroundColor: accent,
            position: "relative",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Gradient overlay for depth */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              backgroundImage:
                "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 100%)",
            }}
          />

          {/* Left 40%: business + card name + reward */}
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
                  {circles
                    .slice(rowIdx * cols, rowIdx * cols + cols)
                    .map((c) => (
                      <div
                        key={c.key}
                        style={{
                          width: `${circleSize}px`,
                          height: `${circleSize}px`,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: c.filled
                            ? "white"
                            : "rgba(255,255,255,0.05)",
                          border: c.filled
                            ? "2px solid white"
                            : "2px solid rgba(255,255,255,0.8)",
                          color: accent,
                          fontSize: Math.floor(circleSize * 0.5),
                          fontWeight: 800,
                          lineHeight: 1,
                        }}
                      >
                        {c.filled ? "✓" : ""}
                      </div>
                    ))}
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
