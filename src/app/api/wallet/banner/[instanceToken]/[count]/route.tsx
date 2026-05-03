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
// (heroImage).
//
// Apple Wallet — storeCard avec QR : strip.png attendu en 375×123 (1x), 750×246 (2x),
// 1125×369 (3x). On génère le @3x et iOS scale les autres. Ratio ~3:1.
// Apple **rejette silencieusement** une strip dont les dimensions ne respectent
// pas ce format (résultat: bannière invisible côté pass).
//
// Google Wallet — heroImage accepte n'importe quel ratio mais 1125×369 marche aussi.
//
// On NE rend QUE la grille de tampons, centrée, sur fond accent_color OU photo
// du merchant si banner_url. Aucun texte sur le strip — Apple/Google posent
// leurs propres champs autour.
const WIDTH = 1125;
const HEIGHT = 369;

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
 * Pré-fetch une image distante et la convertit en data URI.
 *
 * Pourquoi : Satori (utilisé par next/og ImageResponse) tente de fetcher les
 * images externes pendant le rendu, avec un timeout court (~4s) et sans retry.
 * Si Supabase Storage est en cold start ou si l'image est lourde, la fetch
 * échoue silencieusement → la strip ressort SANS la bannière (= invisible
 * côté Apple Wallet). Le pre-fetch côté Node (10s timeout, conversion en data
 * URI) garantit que Satori n'a plus aucun call externe à faire au rendu.
 *
 * Renvoie null si fetch impossible — la rendering tombera sur le gradient
 * accent_color sans casser.
 */
async function prefetchAsDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[wallet-banner] prefetch ${url}: HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn(`[wallet-banner] prefetch failed for ${url}:`, err);
    return null;
  }
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
    const bannerSourceUrl = (design.banner_url as string | null) || null;
    // Pré-fetch en data URI pour fiabiliser le rendu Satori (voir helper).
    const bannerUrl = await prefetchAsDataUri(bannerSourceUrl);
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
    // Cap intelligent basé sur le NOMBRE DE LIGNES, pas juste le total. Apple
    // Wallet rend le strip à largeur fixe ~375px sur l'iPhone — si on autorise
    // des stamps de 200px en source, ils sont scalés à ~67px à l'écran ce qui
    // est OK. Mais sur 1 ligne avec peu de tampons, on les laissait monter à
    // 200px verticalement → ils dépassaient du strip côté Apple (le ratio ~3:1
    // imposé par PassKit était cassé visuellement). Solution : caper la
    // hauteur max d'un stamp en fonction de la hauteur DISPONIBLE.
    const dense = stampsTotal >= 12;
    const padding = dense ? 64 : 36;
    const gap = dense ? 14 : 22;
    const maxByW = (WIDTH - padding * 2 - gap * (cols - 1)) / cols;
    const maxByH = (HEIGHT - padding * 2 - gap * (rows - 1)) / rows;
    // Hard cap par nb de lignes pour respecter le ratio strip Apple :
    // 1 ligne (≤5 stamps) -> 130px max  (avant: 200px → débordait)
    // 2 lignes (6-12)     -> 120px max
    // 3+ lignes           -> 100px max
    const upperCap = rows === 1 ? 130 : rows === 2 ? 120 : 100;
    const stampSize = Math.max(
      48,
      Math.min(upperCap, Math.floor(Math.min(maxByW, maxByH))),
    );

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
              strip image. Le crédit "Propulsé par aswallet" est désormais affiché
              sous le code-barres (altText du barcode Apple/Google). */}
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          // No cache long terme : quand le merchant met à jour son design
          // (banner, logo, accent), la nouvelle image doit s'afficher au prochain
          // refetch sans attendre que le CDN expire. Apple/Google fetch quand
          // l'URL change (count varie après chaque scan), donc s-maxage long
          // était redondant et masquait les bugs.
          "Cache-Control": "public, max-age=10, s-maxage=10, must-revalidate",
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
  // intérieure rendue dans le MÊME SVG (path enfant). Pas de SVG nested
  // (incompatible Satori). La forme + l'icône suivent toujours le choix
  // merchant (stamp_shape + stamp_active_icon dans design).
  //
  // Couleurs : la **couleur d'accent du merchant** est appliquée AUX DEUX états
  // pour que la marque soit visible partout. Les tampons VIDES affichent quand
  // même l'icône en accent_color mais à 35% d'opacité (au lieu de gris fixe).
  // Comme ça même sur une carte neuve (0/10) on voit déjà la couleur de marque.
  const shapeFill = "#ffffff";
  const shapeStroke = p.accent;
  const shapeStrokeWidth = p.filled ? 0.6 : 1.1;
  const iconFill = p.accent;
  const iconOpacity = p.filled ? 1 : 0.35;

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
