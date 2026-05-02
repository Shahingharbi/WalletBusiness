"use client";

import { cn } from "@/lib/utils";
import {
  getIconPath,
  getShapePath,
  normalizeIconKey,
  normalizeShape,
  type StampShape as RenderShape,
} from "@/lib/stamp-render";

export type StampShape = RenderShape;

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

const SIZE = {
  sm: { box: "h-7 w-7", gap: "gap-1.5" },
  md: { box: "h-9 w-9", gap: "gap-2" },
  lg: { box: "h-11 w-11", gap: "gap-2.5" },
};

/**
 * Rendu d'une grille de tampons IDENTIQUE à celle utilisée dans le wallet
 * (cf. `src/lib/stamp-render.ts`). On utilise les mêmes path SVG pour la
 * forme et pour l'icône, dans un unique <svg viewBox="0 0 24 24"> — ce qui
 * garantit la pixel-parity entre l'aperçu in-app et la strip image embarquée
 * dans Apple/Google Wallet.
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
  const sz = SIZE[size];
  const normalizedShape = normalizeShape(shape);
  const normalizedIcon = normalizeIconKey(iconKey ?? null, "check");
  const shapePath = getShapePath(normalizedShape);
  const iconPath = getIconPath(normalizedIcon);

  return (
    <div className={cn("flex flex-wrap justify-center", sz.gap)}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < collected;

        // Custom image overrides icon — on garde le ratio sans masquage,
        // border-radius pour approximer la shape (compromis pratique, identique
        // à la logique côté banner route).
        if (isFilled && activeImageUrl) {
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center overflow-hidden shadow-sm",
                sz.box,
              )}
              style={{
                borderRadius:
                  normalizedShape === "circle"
                    ? "50%"
                    : normalizedShape === "squircle"
                      ? "30%"
                      : "12%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          );
        }
        if (!isFilled && inactiveImageUrl) {
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center overflow-hidden opacity-60",
                sz.box,
              )}
              style={{
                borderRadius:
                  normalizedShape === "circle"
                    ? "50%"
                    : normalizedShape === "squircle"
                      ? "30%"
                      : "12%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inactiveImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          );
        }

        // SVG identique à `stamp-render.getShapePath/getIconPath` — c'est
        // littéralement le même rendu que côté wallet, à la taille près.
        const shapeStroke = isFilled ? accentColor : `${accentColor}55`;
        const shapeStrokeWidth = isFilled ? 0.5 : 0.8;
        const iconFill = isFilled ? accentColor : accentColor;
        const iconOpacity = isFilled ? 1 : 0.3;

        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center",
              sz.box,
              isFilled && "animate-stamp-pop",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-full h-full"
              role="presentation"
            >
              <path
                d={shapePath}
                fill="#ffffff"
                stroke={shapeStroke}
                strokeWidth={shapeStrokeWidth}
                strokeLinejoin="round"
              />
              <path d={iconPath} fill={iconFill} opacity={iconOpacity} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
