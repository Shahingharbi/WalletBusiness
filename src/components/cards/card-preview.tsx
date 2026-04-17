"use client";

import { Store, Percent, Crown, CircleDollarSign } from "lucide-react";
import { StampDisplay } from "@/components/cards/stamp-display";
import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";

interface CardPreviewProps {
  cardName: string;
  stampCount: number;
  rewardText: string;
  collectedStamps?: number;
  design: typeof DEFAULT_CARD_DESIGN;
  cardType?: CardType;
}

export function CardPreview({
  cardName,
  stampCount,
  rewardText,
  collectedStamps = 3,
  design,
  cardType = "stamp",
}: CardPreviewProps) {
  const bgColor = design.background_color || "#ffffff";
  const textColor = design.text_color || "#1a1a1a";
  const accentColor = design.accent_color || "#e53e3e";

  return (
    <div className="flex justify-center">
      {/* iPhone frame */}
      <div className="relative w-[280px]">
        {/* Phone outer shell */}
        <div className="bg-gray-900 rounded-[40px] p-3 shadow-2xl">
          {/* Notch / Dynamic Island */}
          <div className="flex justify-center mb-2">
            <div className="w-24 h-6 bg-black rounded-full" />
          </div>

          {/* Screen area */}
          <div className="bg-gray-100 rounded-[28px] overflow-hidden min-h-[480px] flex flex-col">
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 py-2 text-[10px] font-medium text-gray-900">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  <div className="w-1 h-1.5 bg-gray-900 rounded-sm" />
                  <div className="w-1 h-2 bg-gray-900 rounded-sm" />
                  <div className="w-1 h-2.5 bg-gray-900 rounded-sm" />
                  <div className="w-1 h-3 bg-gray-900 rounded-sm" />
                </div>
                <div className="w-4 h-2 border border-gray-900 rounded-sm ml-1">
                  <div className="w-2.5 h-full bg-gray-900 rounded-sm" />
                </div>
              </div>
            </div>

            {/* Card content */}
            <div className="flex-1 px-3 pb-4">
              <div
                className="rounded-2xl overflow-hidden shadow-lg h-full flex flex-col"
                style={{ backgroundColor: bgColor }}
              >
                {/* Banner / Header */}
                <div
                  className="relative h-28 flex items-end"
                  style={{
                    background: design.banner_url
                      ? `url(${design.banner_url}) center/cover`
                      : `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}44 100%)`,
                  }}
                >
                  {/* Logo */}
                  <div className="absolute top-3 left-3">
                    {design.logo_url ? (
                      <img
                        src={design.logo_url}
                        alt="Logo"
                        className="w-10 h-10 rounded-lg object-cover bg-white shadow-sm"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Store className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Card name overlay */}
                  <div className="p-3 w-full">
                    <h3
                      className="text-sm font-bold truncate"
                      style={{ color: textColor }}
                    >
                      {cardName || "Nom de la carte"}
                    </h3>
                  </div>
                </div>

                {/* Type-specific section */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  {cardType === "stamp" || cardType === "cashback" ? (
                    <div className="space-y-3">
                      <p
                        className="text-[10px] font-medium text-center uppercase tracking-wider opacity-60"
                        style={{ color: textColor }}
                      >
                        {cardType === "cashback"
                          ? design.label_stamps || "Visites avant cashback"
                          : design.label_stamps || "Tampons avant recompense"}
                      </p>

                      <StampDisplay
                        total={stampCount}
                        collected={Math.min(collectedStamps, stampCount)}
                        accentColor={accentColor}
                        size="sm"
                      />

                      <p
                        className="text-[11px] text-center font-medium"
                        style={{ color: textColor }}
                      >
                        {Math.min(collectedStamps, stampCount)} / {stampCount}
                      </p>
                    </div>
                  ) : cardType === "discount" ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-2">
                      <Percent
                        className="h-12 w-12"
                        style={{ color: accentColor }}
                      />
                      <p
                        className="text-[10px] font-medium uppercase tracking-wider opacity-60"
                        style={{ color: textColor }}
                      >
                        Remise active
                      </p>
                    </div>
                  ) : cardType === "membership" ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-2">
                      <Crown
                        className="h-12 w-12"
                        style={{ color: accentColor }}
                      />
                      <p
                        className="text-[10px] font-medium uppercase tracking-wider opacity-60"
                        style={{ color: textColor }}
                      >
                        Membre actif
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-2">
                      <CircleDollarSign
                        className="h-12 w-12"
                        style={{ color: accentColor }}
                      />
                    </div>
                  )}

                  {/* Reward / benefit */}
                  <div className="mt-3 space-y-2">
                    <div
                      className="rounded-lg py-2 px-3 text-center"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        borderColor: `${accentColor}30`,
                        borderWidth: 1,
                      }}
                    >
                      <p
                        className="text-[10px] font-medium opacity-60"
                        style={{ color: textColor }}
                      >
                        {cardType === "stamp"
                          ? design.label_rewards || "Recompense disponible"
                          : cardType === "cashback"
                            ? "Cashback"
                            : cardType === "discount"
                              ? "Avantage"
                              : "Statut membre"}
                      </p>
                      <p
                        className="text-xs font-semibold mt-0.5"
                        style={{ color: accentColor }}
                      >
                        {rewardText || "A definir"}
                      </p>
                    </div>
                  </div>

                  {/* Barcode area */}
                  <div className="mt-4 flex flex-col items-center gap-1.5">
                    <div className="w-full h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                      {/* Fake barcode lines */}
                      <div className="flex gap-px items-end h-6">
                        {Array.from({ length: 32 }, (_, i) => (
                          <div
                            key={i}
                            className="bg-gray-900 rounded-sm"
                            style={{
                              width: Math.random() > 0.5 ? 2 : 1,
                              height: `${60 + Math.random() * 40}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <span
                      className="text-[8px] opacity-40"
                      style={{ color: textColor }}
                    >
                      Scanner pour tamponner
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center mt-2">
            <div className="w-28 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
