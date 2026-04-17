"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StampDisplayProps {
  total: number;
  collected: number;
  accentColor: string;
  size?: "sm" | "md" | "lg";
}

export function StampDisplay({
  total,
  collected,
  accentColor,
  size = "md",
}: StampDisplayProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < collected;
        return (
          <div
            key={i}
            className={cn(
              "rounded-full flex items-center justify-center transition-all duration-200",
              sizeClasses[size],
              isFilled
                ? "shadow-sm"
                : "border-2 border-gray-300 bg-white/50"
            )}
            style={
              isFilled
                ? { backgroundColor: accentColor }
                : undefined
            }
          >
            {isFilled && (
              <Check className={cn(iconSizes[size], "text-white")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
