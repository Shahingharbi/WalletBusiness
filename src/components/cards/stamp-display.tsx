"use client";

import { cn } from "@/lib/utils";
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

const GAP: Record<NonNullable<StampDisplayProps["size"]>, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2.5",
};

/**
 * Grille de tampons rendue avec EXACTEMENT le même SVG que dans le wallet
 * Apple/Google et que dans l'aperçu de l'éditeur (cf. `<StampSvg />` qui
 * délègue à `lib/stamp-render`). Pixel-parity garantie sur les 3 surfaces.
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
  return (
    <div className={cn("flex flex-wrap justify-center", GAP[size])}>
      {Array.from({ length: total }, (_, i) => (
        <StampSvg
          key={i}
          filled={i < collected}
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
  );
}
