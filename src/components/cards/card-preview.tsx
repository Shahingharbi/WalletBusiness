"use client";

import { useEffect, useMemo, useState } from "react";
import { Percent, Crown, CircleDollarSign, Wifi, Signal, BatteryFull } from "lucide-react";
import QRCode from "qrcode";
import { StampDisplay } from "@/components/cards/stamp-display";
import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CardPreviewProps {
  cardName: string;
  stampCount: number;
  rewardText: string;
  collectedStamps?: number;
  design: typeof DEFAULT_CARD_DESIGN;
  cardType?: CardType;
  businessName?: string;
  /**
   * Override optionnel pour le top-left du pass (équivalent du champ
   * `wallet_business_name` côté DB). Affiché à la place de `businessName`
   * dans l'aperçu si fourni.
   */
  walletBusinessName?: string | null;
  barcodeType?: "qr" | "pdf417";
}

type Device = "ios" | "android";

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function bestContrastTextColor(bg: string): string {
  return luminance(bg) > 0.55 ? "#1a1a1a" : "#ffffff";
}

/**
 * Deterministic PDF417-style visualization (not a real encoder — for mockup preview only).
 * Renders a dense SVG grid with guard bars, start/stop patterns, centered in the container.
 */
function Pdf417Visual({ value }: { value: string }) {
  const rows = 6;
  const cols = 56;

  const cells = useMemo(() => {
    let s = 0;
    for (let i = 0; i < value.length; i++) s = (s * 131 + value.charCodeAt(i)) & 0x7fffffff;
    const grid: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < cols; c++) {
        // Start / stop guard patterns
        if (c <= 1 || c >= cols - 2) {
          row.push((c + r) % 2 === 0 || c === 0 || c === cols - 1);
          continue;
        }
        // Row-indicator columns
        if (c === 2 || c === cols - 3) {
          row.push((r + (c === 2 ? 0 : 1)) % 2 === 0);
          continue;
        }
        s = (s * 1103515245 + 12345 + r * 7 + c) & 0x7fffffff;
        // Bias toward ~48% density (denser than random for a PDF417 look)
        row.push(s % 100 < 48);
      }
      grid.push(row);
    }
    return grid;
  }, [value]);

  return (
    <div className="flex justify-center w-full">
      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        className="w-[85%] h-10 rounded-sm"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
        <rect width={cols} height={rows} fill="#ffffff" />
        {cells.map((row, r) =>
          row.map((on, c) =>
            on ? (
              <rect
                key={`${r}-${c}`}
                x={c}
                y={r}
                width={1}
                height={1}
                fill="#000000"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

export function CardPreview({
  cardName,
  stampCount,
  rewardText,
  collectedStamps = 3,
  design,
  cardType = "stamp",
  businessName = "Votre commerce",
  walletBusinessName,
  barcodeType = "qr",
}: CardPreviewProps) {
  // Le merchant peut surcharger le nom affiché dans le wallet (logoText
  // Apple / issuerName Google) sans toucher au nom interne du commerce.
  // Aperçu et wallet doivent afficher EXACTEMENT la même chaîne.
  const displayedBusinessName =
    (walletBusinessName && walletBusinessName.trim()) || businessName;
  const [device, setDevice] = useState<Device>("ios");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const accentColor = design.accent_color || "#e53e3e";
  const cardBg = design.background_color || "#ffffff";
  const onCardText = design.text_color || bestContrastTextColor(cardBg);
  const onAccentText = bestContrastTextColor(accentColor);

  // Sample token for preview (stable per card preview session)
  const sampleToken = useMemo(
    () => `preview-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  useEffect(() => {
    if (barcodeType !== "qr") {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(sampleToken, {
      width: 260,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [sampleToken, barcodeType]);

  const isWalletStyleCard = true; // future: toggle styles

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Device toggle */}
      <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setDevice("ios")}
          className={cn(
            "px-3 py-1 rounded-full transition-colors",
            device === "ios" ? "bg-black text-white" : "text-gray-500 hover:text-gray-800"
          )}
        >
          Apple Wallet
        </button>
        <button
          type="button"
          onClick={() => setDevice("android")}
          className={cn(
            "px-3 py-1 rounded-full transition-colors",
            device === "android" ? "bg-black text-white" : "text-gray-500 hover:text-gray-800"
          )}
        >
          Google Wallet
        </button>
      </div>

      {/* Phone frame */}
      <div className="relative w-full max-w-[290px]">
        <div
          className={cn(
            "relative p-3 shadow-2xl",
            device === "ios" ? "bg-gray-900 rounded-[44px]" : "bg-gray-800 rounded-[32px]"
          )}
        >
          {/* Notch */}
          {device === "ios" ? (
            <div className="flex justify-center mb-2">
              <div className="w-24 h-6 bg-black rounded-full" />
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <div className="h-3 w-3 bg-black rounded-full" />
            </div>
          )}

          {/* Screen */}
          <div
            className={cn(
              "relative overflow-hidden flex flex-col",
              device === "ios" ? "rounded-[32px] min-h-[540px]" : "rounded-[22px] min-h-[540px]",
              device === "ios" ? "bg-neutral-100" : "bg-[#0f1115]"
            )}
          >
            {/* Status bar */}
            <div
              className={cn(
                "flex items-center justify-between px-5 pt-2 pb-1 text-[10px] font-semibold",
                device === "ios" ? "text-gray-900" : "text-gray-200"
              )}
            >
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" />
                <Wifi className="h-2.5 w-2.5" />
                <BatteryFull className="h-3 w-3" />
              </div>
            </div>

            {/* Wallet app chrome */}
            <div
              className={cn(
                "px-5 pt-2 pb-3 flex items-center justify-between",
                device === "ios" ? "text-gray-900" : "text-gray-100"
              )}
            >
              <span className="text-[13px] font-semibold">
                {device === "ios" ? "Cartes" : "Google Wallet"}
              </span>
              <div className="text-[11px] opacity-50">...</div>
            </div>

            {/* Card */}
            <div className="px-3 pb-5 flex-1">
              <div
                className={cn(
                  "rounded-[20px] overflow-hidden shadow-xl relative",
                  device === "android" && "shadow-2xl"
                )}
                style={{ backgroundColor: cardBg }}
              >
                {/* Top row: logo + business/program name */}
                <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
                  {design.logo_url ? (
                    <img
                      src={design.logo_url}
                      alt="Logo"
                      className="w-9 h-9 rounded-lg object-cover bg-white shadow-sm border border-black/5"
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold border border-black/5"
                      style={{ backgroundColor: accentColor, color: onAccentText }}
                    >
                      {(displayedBusinessName || cardName || "F").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[10px] font-medium truncate opacity-60"
                      style={{ color: onCardText }}
                    >
                      {displayedBusinessName}
                    </p>
                    <p
                      className="text-[12px] font-bold truncate"
                      style={{ color: onCardText }}
                    >
                      {cardName || "Nom de la carte"}
                    </p>
                  </div>
                </div>

                {/* Hero / strip image */}
                {design.banner_url && (
                  <div className="relative h-24 overflow-hidden">
                    <img
                      src={design.banner_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Double-overlay for guaranteed text contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/15" />
                  </div>
                )}

                {/* Body */}
                <div
                  className="px-4 pt-3 pb-4"
                  style={{
                    background: `linear-gradient(180deg, ${cardBg} 0%, ${cardBg}f5 100%)`,
                    color: onCardText,
                  }}
                >
                  {isWalletStyleCard && (cardType === "stamp" || cardType === "cashback") && (
                    <>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[9px] uppercase tracking-wider font-semibold opacity-55">
                          {cardType === "cashback"
                            ? design.label_stamps || "Visites"
                            : design.label_stamps || "Tampons"}
                        </span>
                        <span className="text-[11px] font-semibold">
                          {Math.min(collectedStamps, stampCount)} / {stampCount}
                        </span>
                      </div>

                      <StampDisplay
                        total={stampCount}
                        collected={Math.min(collectedStamps, stampCount)}
                        accentColor={accentColor}
                        size="sm"
                        iconKey={design.stamp_icon}
                        activeImageUrl={design.stamp_active_url}
                        inactiveImageUrl={design.stamp_inactive_url}
                        shape={design.stamp_shape ?? "circle"}
                      />

                      {/* Reward pill */}
                      <div
                        className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{
                          backgroundColor: `${accentColor}18`,
                          border: `1px solid ${accentColor}35`,
                        }}
                      >
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: accentColor }}
                        />
                        <div className="min-w-0">
                          <p className="text-[8px] uppercase tracking-wider font-semibold opacity-55">
                            {design.label_rewards || "Récompense"}
                          </p>
                          <p
                            className="text-[11px] font-bold truncate"
                            style={{ color: accentColor }}
                          >
                            {rewardText || "À définir"}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {isWalletStyleCard && cardType === "discount" && (
                    <div className="flex items-center gap-3 py-2">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${accentColor}18` }}
                      >
                        <Percent className="h-7 w-7" style={{ color: accentColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-wider font-semibold opacity-55">
                          Avantage
                        </p>
                        <p className="text-[13px] font-bold truncate" style={{ color: accentColor }}>
                          {rewardText || "À définir"}
                        </p>
                      </div>
                    </div>
                  )}

                  {isWalletStyleCard && cardType === "membership" && (
                    <div className="flex items-center gap-3 py-2">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${accentColor}18` }}
                      >
                        <Crown className="h-7 w-7" style={{ color: accentColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-wider font-semibold opacity-55">
                          Statut
                        </p>
                        <p className="text-[13px] font-bold truncate" style={{ color: accentColor }}>
                          {rewardText || "Membre"}
                        </p>
                      </div>
                    </div>
                  )}

                  {!["stamp", "cashback", "discount", "membership"].includes(cardType) && (
                    <div className="flex items-center gap-3 py-2">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${accentColor}18` }}
                      >
                        <CircleDollarSign className="h-7 w-7" style={{ color: accentColor }} />
                      </div>
                      <p className="text-[13px] font-bold truncate" style={{ color: accentColor }}>
                        {rewardText || "À définir"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Barcode block */}
                <div className="bg-white px-4 py-3 flex flex-col items-center gap-1 border-t border-black/5">
                  {barcodeType === "qr" ? (
                    <>
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR" className="w-24 h-24" />
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 rounded animate-pulse" />
                      )}
                      {/* On remplace le serial number (chaîne aléatoire) par
                          un crédit clair, identique à l'altText du barcode
                          dans Apple/Google Wallet. */}
                      <span className="text-[9px] text-gray-500 tracking-wide">
                        Signé par aswallet
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-full">
                        <Pdf417Visual value={sampleToken} />
                      </div>
                      <span className="text-[9px] text-gray-500 tracking-wide mt-1">
                        Signé par aswallet
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Subtle hint below card */}
              <p
                className={cn(
                  "text-center text-[10px] mt-3",
                  device === "ios" ? "text-gray-400" : "text-gray-500"
                )}
              >
                Glisser pour modifier · Double-taper pour les infos
              </p>
            </div>
          </div>

          {/* Home indicator */}
          {device === "ios" && (
            <div className="flex justify-center mt-2">
              <div className="w-28 h-1 bg-gray-600 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
