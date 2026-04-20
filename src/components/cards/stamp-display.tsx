"use client";

import { cn } from "@/lib/utils";
import { STAMP_ICONS, getStampIcon } from "@/lib/stamp-icons";

export type StampShape = "circle" | "squircle" | "shield" | "star" | "hex";

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
  sm: { box: "h-7 w-7", icon: "h-3.5 w-3.5", gap: "gap-1.5" },
  md: { box: "h-9 w-9", icon: "h-4.5 w-4.5", gap: "gap-2" },
  lg: { box: "h-11 w-11", icon: "h-5.5 w-5.5", gap: "gap-2.5" },
};

const SHAPE_CLASS: Record<StampShape, string> = {
  circle: "rounded-full",
  squircle: "rounded-[35%]",
  shield: "rounded-t-full rounded-b-lg",
  star: "",
  hex: "",
};

// Star / hex rely on clip-path
const SHAPE_STYLE: Partial<Record<StampShape, React.CSSProperties>> = {
  star: {
    clipPath:
      "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  },
  hex: {
    clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
  },
};

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
  const { Icon } = STAMP_ICONS[getStampIcon(iconKey)];
  const shapeCls = SHAPE_CLASS[shape];
  const shapeStyle = SHAPE_STYLE[shape];
  const hasClip = Boolean(shapeStyle);

  return (
    <div className={cn("flex flex-wrap justify-center", sz.gap)}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < collected;

        // Custom image overrides icon
        if (isFilled && activeImageUrl) {
          return (
            <div
              key={i}
              className={cn("flex items-center justify-center overflow-hidden shadow-sm", sz.box, !hasClip && shapeCls)}
              style={hasClip ? shapeStyle : undefined}
            >
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
              className={cn("flex items-center justify-center overflow-hidden opacity-60", sz.box, !hasClip && shapeCls)}
              style={hasClip ? shapeStyle : undefined}
            >
              <img
                src={inactiveImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          );
        }

        if (isFilled) {
          return (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center shadow-sm animate-stamp-pop text-white",
                sz.box,
                !hasClip && shapeCls
              )}
              style={{
                backgroundColor: accentColor,
                ...(shapeStyle ?? {}),
              }}
            >
              <Icon className={sz.icon} />
            </div>
          );
        }

        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center border-2 border-dashed",
              sz.box,
              !hasClip && shapeCls
            )}
            style={{
              borderColor: `${accentColor}55`,
              backgroundColor: `${accentColor}10`,
              color: accentColor,
              ...(shapeStyle ?? {}),
            }}
          >
            <Icon className={cn(sz.icon, "opacity-30")} />
          </div>
        );
      })}
    </div>
  );
}
