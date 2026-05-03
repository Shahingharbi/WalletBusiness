import { ImageResponse } from "next/og";

/**
 * Open Graph image — 1200x630.
 *
 * Rendered on demand at the edge so we don't have to ship a static asset.
 * Used by `src/app/layout.tsx` `openGraph.images` and Twitter card metadata.
 *
 * To customize, tweak the inline JSX below — `next/og` supports a small
 * subset of CSS via inline styles only.
 */
export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#f9f7f0",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#0a0a0a",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          aswallet
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#0a0a0a",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: 980,
          }}
        >
          La carte de fidélité digitale pour commerces de proximité.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 48,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFE94D",
              borderRadius: 999,
              color: "#0a0a0a",
              fontSize: 24,
              fontWeight: 600,
              padding: "16px 32px",
            }}
          >
            Essai gratuit 30 jours
          </div>
          <div
            style={{
              color: "#6b6b6b",
              fontSize: 22,
              marginLeft: 28,
            }}
          >
            aswallet.fr
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
