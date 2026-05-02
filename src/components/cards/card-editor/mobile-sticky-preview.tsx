"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { CardPreview } from "@/components/cards/card-preview";
import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface MobileStickyPreviewProps {
  cardName: string;
  stampCount: number;
  rewardText: string;
  design: typeof DEFAULT_CARD_DESIGN;
  cardType: CardType;
  barcodeType?: "qr" | "pdf417";
  /** Optional sticky offset (px) so it sits below other sticky bars. */
  topOffset?: number;
  businessName?: string;
  walletBusinessName?: string | null;
}

/**
 * Compact, always-visible card preview for mobile only.
 *
 * - Sticky at the top of the scroll container.
 * - Renders the wallet card itself (no phone frame, no toolbar) at a small fixed height.
 * - Tap "Agrandir" to open the full <CardPreview /> in a modal sheet.
 *
 * Hidden on lg+ where the full preview is shown side-by-side.
 */
export function MobileStickyPreview({
  cardName,
  stampCount,
  rewardText,
  design,
  cardType,
  barcodeType = "qr",
  topOffset = 0,
  businessName,
  walletBusinessName,
}: MobileStickyPreviewProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const accentColor = design.accent_color || "#e53e3e";
  const cardBg = design.background_color || "#ffffff";
  const onCardText = design.text_color || "#1a1a1a";

  return (
    <>
      <div
        className="lg:hidden sticky z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 bg-gradient-to-b from-gray-50 via-gray-50/95 to-gray-50/0 backdrop-blur-sm"
        style={{ top: topOffset }}
      >
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Aperçu en direct
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 hover:text-black bg-white border border-gray-200 hover:border-gray-400 rounded-full px-2.5 py-1 transition-colors cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" />
            Agrandir
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Agrandir l'aperçu"
          className="w-full block group cursor-pointer"
        >
          <div
            className="rounded-[18px] overflow-hidden shadow-md border border-black/5 mx-auto max-w-[340px] transition-transform group-active:scale-[0.99]"
            style={{ backgroundColor: cardBg }}
          >
            {/* Compact wallet-style card (~190px high) */}
            <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
              {design.logo_url ? (
                <img
                  src={design.logo_url}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover bg-white shadow-sm border border-black/5"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border border-black/5"
                  style={{ backgroundColor: accentColor, color: "#fff" }}
                >
                  {(cardName || "F").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p
                  className="text-[10px] font-medium truncate opacity-60"
                  style={{ color: onCardText }}
                >
                  {cardName || "Ma carte"}
                </p>
                <p
                  className="text-[12px] font-bold truncate"
                  style={{ color: onCardText }}
                >
                  {rewardText || "Votre récompense"}
                </p>
              </div>
            </div>

            {design.banner_url && (
              <div className="relative h-14 overflow-hidden">
                <img
                  src={design.banner_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            )}

            <div
              className="px-4 pt-2 pb-3"
              style={{ color: onCardText }}
            >
              {(cardType === "stamp" || cardType === "cashback") ? (
                <>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[8px] uppercase tracking-wider font-semibold opacity-55">
                      {cardType === "cashback"
                        ? design.label_stamps || "Visites"
                        : design.label_stamps || "Tampons"}
                    </span>
                    <span className="text-[10px] font-semibold">
                      3 / {stampCount}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: Math.min(stampCount, 12) }).map((_, i) => {
                      const filled = i < 3;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "h-3 w-3 rounded-full border",
                            filled ? "" : "opacity-30"
                          )}
                          style={{
                            backgroundColor: filled ? accentColor : "transparent",
                            borderColor: accentColor,
                          }}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      backgroundColor: `${accentColor}22`,
                      color: accentColor,
                    }}
                  >
                    {cardType === "discount" ? "%" : "★"}
                  </div>
                  <p
                    className="text-[11px] font-bold truncate"
                    style={{ color: accentColor }}
                  >
                    {rewardText || "À définir"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Expanded modal */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative mt-auto bg-white rounded-t-2xl max-h-[92vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-sm border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                Aperçu en direct
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <CardPreview
                cardName={cardName || "Ma carte"}
                stampCount={stampCount}
                rewardText={rewardText || "Votre récompense"}
                design={design}
                cardType={cardType}
                barcodeType={barcodeType}
                businessName={businessName || undefined}
                walletBusinessName={walletBusinessName ?? null}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
