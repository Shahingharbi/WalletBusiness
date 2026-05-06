"use client";

import { StampSvg, type StampShape } from "./stamp-svg";

export type { StampShape };

interface StampDisplayProps {
  total: number;
  collected: number;
  accentColor: string;
  size?: "sm" | "md" | "lg";
  iconKey?: string | null;
  activeImageUrl?: string | null;
  inactiveImageUrl?: string | null;
  shape?: StampShape;
}

const SIZE_PX: Record<NonNullable<StampDisplayProps["size"]>, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

const GAP_PX: Record<NonNullable<StampDisplayProps["size"]>, number> = {
  sm: 6,
  md: 8,
  lg: 10,
};

/**
 * Choix de grille IDENTIQUE au strip image côté wallet :
 *   /api/wallet/banner/[...]/route.tsx::pickGrid()
 *
 * Garantit que le client voit la même disposition (4×4, 5×2, 6×3, etc.)
 * sur la status page web et dans son Apple/Google Wallet réel. Avant on
 * utilisait `flex-wrap` qui produisait des dispositions irrégulières genre
 * 6+2 sur 8 stamps mobile = moche.
 */
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
 * Grille de tampons rendue avec EXACTEMENT le même SVG que dans le wallet
 * Apple/Google et que dans l'aperçu de l'éditeur (cf. `<StampSvg />` qui
 * délègue à `lib/stamp-render`). Pixel-parity + grille-parity garanties.
 */
export function StampDisplay({
  total,
  collected,
  accentColor,
  size = "md",
  iconKey,
  activeImageUrl,
  inactiveImageUrl,
  shape = "circle",
}: StampDisplayProps) {
  const px = SIZE_PX[size];
  const gap = GAP_PX[size];
  const { cols, rows } = pickGrid(Math.max(1, Math.min(20, total)));

  // Génération en deux étapes : on calcule chaque rangée explicitement
  // plutôt que de laisser flex-wrap décider. Comme ça les 8 tampons font
  // toujours 4+4 (jamais 6+2 ou 5+3 en fonction de la largeur container).
  const allStamps = Array.from({ length: total }, (_, i) => i < collected);
  const rowsArr: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    rowsArr.push(allStamps.slice(r * cols, (r + 1) * cols));
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{ gap: `${gap}px` }}
    >
      {rowsArr.map((row, r) => (
        <div
          key={r}
          className="flex items-center justify-center"
          style={{ gap: `${gap}px` }}
        >
          {row.map((isFilled, idx) => (
            <StampSvg
              key={idx}
              filled={isFilled}
              size={px}
              accent={accentColor}
              shape={shape}
              iconKey={iconKey}
              activeUrl={activeImageUrl}
              inactiveUrl={inactiveImageUrl}
              animated
            />
          ))}
        </div>
      ))}
    </div>
  );
}
