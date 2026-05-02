import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import {
  getIconPath,
  getShapePath,
  normalizeIconKey,
  normalizeShape,
  type StampShape,
} from "@/lib/stamp-render";

export const runtime = "nodejs";

// Image utilisée à la fois pour Apple Wallet (strip image) et Google Wallet
// (heroImage). Ratio ~3:1. On NE rend QUE la grille de tampons, centrée, sur
// fond accent_color. Aucun texte, aucun nom de commerce, aucun compteur.
// Toutes les autres infos (logo commerce, points, prochaine récompense...) sont
// rendues par le wallet lui-même via les fields du pass.json.
const WIDTH = 1032;
const HEIGHT = 336;

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
    // L'icône intérieure : on accepte plusieurs conventions de nommage et on
    // tombe sur le legacy `stamp_icon` si jamais `stamp_active_icon` est vide.
    const filledIconKey = normalizeIconKey(
      (design.stamp_active_icon as string) ||
        (design.stamp_icon as string) ||
        "check",
      "check",
    );
    // Pour les tampons vides, on AFFICHE LA MÊME ICÔNE (à faible opacité)
    // plutôt qu'une silhouette générique : c'est plus clair pour le client de
    // voir la même forme partout, juste fanée tant qu'elle n'est pas obtenue.
    const emptyIconKey = filledIconKey;

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
    // Padding adaptatif : on respire plus quand on a peu de tampons (gros stamps),
    // mais on resserre la marge horizontale quand on en a 12+ (sinon les bords
    // de l'iPhone collent les tampons et c'est moche). On limite aussi la
    // taille max d'un tampon à 110px en grille dense pour éviter les "boutons"
    // géants qui mangent toute l'image.
    const dense = stampsTotal >= 12;
    const padding = dense ? 56 : 28;
    const gap = dense ? 14 : 18;
    const maxByW = (WIDTH - padding * 2 - gap * (cols - 1)) / cols;
    const maxByH = (HEIGHT - padding * 2 - gap * (rows - 1)) / rows;
    const upperCap = dense ? 110 : 200;
    const stampSize = Math.max(60, Math.min(upperCap, Math.floor(Math.min(maxByW, maxByH))));

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
                {row.map((s) =>
                  renderStamp({
                    filled: s.filled,
                    size: stampSize,
                    shape,
                    accent,
                    activeUrl: stampActiveUrl,
                    inactiveUrl: stampInactiveUrl,
                    iconKey: s.filled ? filledIconKey : emptyIconKey,
                    key: s.idx,
                  }),
                )}
              </div>
            ))}
          </div>

          {/* Footer "Powered by aswallet" supprimé — on ne signe plus la
              strip image. Le crédit "Signé par aswallet" est désormais affiché
              sous le code-barres (altText du barcode Apple/Google). */}
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
  shape: StampShape;
  accent: string;
  activeUrl: string | null;
  inactiveUrl: string | null;
  iconKey: string;
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

  // Style Boomerangme avec VRAIE forme SVG (star, shield, hex, etc.) ET icône
  // intérieure rendue dans le MÊME SVG (path enfant), ce qui évite tout SVG
  // nested (incompatible Satori) et garantit que la forme + l'icône changent
  // ensemble selon les choix du merchant.
  const shapeFill = "#ffffff";
  const shapeStroke = p.filled ? p.accent : "rgba(255,255,255,0.55)";
  const shapeStrokeWidth = p.filled ? 0.5 : 0.8;
  // Filled  -> icône en couleur d'accent, opacité 100% (lisible sur fond blanc)
  // Empty   -> icône en gris très clair, opacité 30% (présente mais discrète)
  const iconFill = p.filled ? p.accent : "#9ca3af";
  const iconOpacity = p.filled ? 1 : 0.3;

  const shapePath = getShapePath(p.shape);
  const iconPath = getIconPath(p.iconKey);

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
      <svg
        width={p.size}
        height={p.size}
        viewBox="0 0 24 24"
        style={{ display: "flex" }}
      >
        {/* Forme extérieure */}
        <path
          d={shapePath}
          fill={shapeFill}
          stroke={shapeStroke}
          strokeWidth={shapeStrokeWidth}
          strokeLinejoin="round"
        />
        {/* Icône intérieure — même viewBox 24x24, donc centrée naturellement */}
        <path d={iconPath} fill={iconFill} opacity={iconOpacity} />
      </svg>
    </div>
  );
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
