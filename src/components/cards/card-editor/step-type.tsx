"use client";

import {
  Stamp,
  Gift,
  Users,
  Percent,
  CircleDollarSign,
  Tag,
  CreditCard,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CARD_TYPES, type CardType } from "@/lib/constants";

const iconMap: Record<string, LucideIcon> = {
  Stamp,
  Gift,
  Users,
  Percent,
  CircleDollarSign,
  Tag,
  CreditCard,
  Layers,
};

const descriptions: Record<CardType, string> = {
  stamp: "Carte à tampons classique",
  reward: "Récompenses par paliers",
  membership: "Carte de membre",
  discount: "Remise progressive",
  cashback: "Retour en argent",
  coupon: "Bons de réduction",
  gift: "Cartes cadeaux",
  multipass: "Pass multi-commerces",
};

interface StepTypeProps {
  value: CardType;
  onChange: (type: CardType) => void;
}

export function StepType({ value, onChange }: StepTypeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Type de carte
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Choisissez le type de carte de fidélité à créer
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(Object.entries(CARD_TYPES) as [CardType, (typeof CARD_TYPES)[CardType]][]).map(
          ([key, type]) => {
            const Icon = iconMap[type.icon];
            const isAvailable = type.available;
            const isSelected = value === key;

            return (
              <button
                key={key}
                type="button"
                disabled={!isAvailable}
                onClick={() => isAvailable && onChange(key)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150",
                  isAvailable && "cursor-pointer",
                  isSelected
                    ? "border-black bg-black text-white shadow-md"
                    : isAvailable
                      ? "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:shadow-sm"
                      : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
                )}
              >
                {!isAvailable && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5"
                  >
                    Bientôt
                  </Badge>
                )}
                {Icon && (
                  <Icon
                    className={cn(
                      "h-6 w-6",
                      isSelected ? "text-white" : isAvailable ? "text-gray-700" : "text-gray-300"
                    )}
                  />
                )}
                <span className="text-sm font-medium">{type.label}</span>
                <span
                  className={cn(
                    "text-[11px] leading-tight",
                    isSelected ? "text-gray-300" : "text-gray-400"
                  )}
                >
                  {descriptions[key]}
                </span>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
