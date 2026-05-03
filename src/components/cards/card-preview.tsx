"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wifi,
  Signal,
  BatteryFull,
  Percent,
  Crown,
  CircleDollarSign,
} from "lucide-react";
import QRCode from "qrcode";
import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";
import { googleEffectiveBgColor, luminance } from "@/lib/wallet-colors";
import {
  getIconPath,
  getShapePath,
  normalizeIconKey,
  normalizeShape,
} from "@/lib/stamp-render";
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
  /** Prénom client simulé pour la zone "Bonjour {firstName}". */
  customerFirstName?: string;
  /**
   * Plate-forme à rendre.
   *  - "apple"  : aperçu Apple Wallet uniquement
   *  - "google" : aperçu Google Wallet uniquement
   *  - "both"   : les deux côte-à-côte (défaut, pour l'éditeur de carte)
   */
  platform?: "apple" | "google" | "both";
}

/**
 * PDF417-style placeholder visualization (not a real encoder — preview only).
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
        if (c <= 1 || c >= cols - 2) {
          row.push((c + r) % 2 === 0 || c === 0 || c === cols - 1);
          continue;
        }
        if (c === 2 || c === cols - 3) {
          row.push((r + (c === 2 ? 0 : 1)) % 2 === 0);
          continue;
        }
        s = (s * 1103515245 + 12345 + r * 7 + c) & 0x7fffffff;
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
        className="w-[80%] h-9 rounded-sm"
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

/**
 * Same pickGrid logic as src/app/api/wallet/banner/.../route.tsx.
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

interface StripStampProps {
  filled: boolean;
  size: number;
  shape: ReturnType<typeof normalizeShape>;
  iconKey: string;
  accent: string;
  activeUrl: string | null;
  inactiveUrl: string | null;
}

function StripStamp({
  filled,
  size,
  shape,
  iconKey,
  accent,
  activeUrl,
  inactiveUrl,
}: StripStampProps) {
  const url = filled ? activeUrl : inactiveUrl;
  if (url) {
    const radius =
      shape === "circle" ? "50%" : shape === "squircle" ? "30%" : "12%";
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          opacity: filled ? 1 : 0.6,
          backgroundColor: "#ffffff",
          boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      </div>
    );
  }

  const shapePath = getShapePath(shape);
  const iconPath = getIconPath(iconKey);
  const shapeFill = "#ffffff";
  const shapeStroke = filled ? accent : "rgba(255,255,255,0.55)";
  const shapeStrokeWidth = filled ? 0.5 : 0.8;
  const iconFill = filled ? accent : "#9ca3af";
  const iconOpacity = filled ? 1 : 0.3;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block" }}
    >
      <path
        d={shapePath}
        fill={shapeFill}
        stroke={shapeStroke}
        strokeWidth={shapeStrokeWidth}
        strokeLinejoin="round"
      />
      <path d={iconPath} fill={iconFill} opacity={iconOpacity} />
    </svg>
  );
}

interface SinglePreviewProps {
  platform: "apple" | "google";
  cardName: string;
  stampCount: number;
  rewardText: string;
  collectedStamps: number;
  design: typeof DEFAULT_CARD_DESIGN;
  cardType: CardType;
  businessName?: string;
  walletBusinessName?: string | null;
  barcodeType: "qr" | "pdf417";
  customerFirstName: string;
}

function SinglePreview({
  platform,
  cardName,
  stampCount,
  rewardText,
  collectedStamps,
  design,
  cardType,
  businessName,
  walletBusinessName,
  barcodeType,
  customerFirstName,
}: SinglePreviewProps) {
  const headerTitle =
    (walletBusinessName && walletBusinessName.trim()) ||
    cardName ||
    businessName ||
    "Ma carte";

  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Couleurs : règles spécifiques à chaque plate-forme.
  const designBg = design.background_color || "#1a1a1a";
  const accentColor = design.accent_color || "#e53e3e";
  const designTextColor = (design.text_color || "").trim();

  // Apple : merchant pilote la couleur de texte. Si vide -> auto-contraste.
  // Google : on auto-flippe le fond vers du sombre si le merchant a choisi
  // clair (Google force le texte blanc -> illisible). Texte toujours blanc.
  const cardBg =
    platform === "apple" ? designBg : googleEffectiveBgColor(designBg, accentColor);
  const onCardText =
    platform === "apple"
      ? designTextColor.length > 0
        ? designTextColor
        : luminance(designBg) > 0.6
          ? "#141414"
          : "#ffffff"
      : "#ffffff";
  // Petit utilitaire pour générer un labelColor lisible dérivé du texte.
  const labelColor =
    onCardText.toLowerCase() === "#ffffff"
      ? "rgba(255,255,255,0.7)"
      : "rgba(20,20,20,0.55)";

  const stampsTotal = Math.max(1, Math.min(20, stampCount));
  const stampsCollected = Math.max(0, Math.min(collectedStamps, stampsTotal));

  const shape = normalizeShape(design.stamp_shape);
  const iconKey = normalizeIconKey(
    (design.stamp_active_icon as string | undefined) ||
      (design.stamp_icon as string | undefined) ||
      "check",
    "check"
  );

  // Token QR stable côté preview.
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
      width: 240,
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

  // Grille de tampons.
  const { cols, rows } = pickGrid(stampsTotal);
  const stripWidth = 280;
  const stripHorizontalPadding = stampsTotal >= 12 ? 14 : 16;
  const stripGap = stampsTotal >= 12 ? 6 : 8;
  const availableW = stripWidth - stripHorizontalPadding * 2 - stripGap * (cols - 1);
  const availableH = 92 - 16 - stripGap * (rows - 1);
  const stampSize = Math.max(
    16,
    Math.floor(Math.min(availableW / cols, availableH / rows))
  );

  const stamps = Array.from({ length: stampsTotal }, (_, i) => i < stampsCollected);
  const rowsArr: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    rowsArr.push(stamps.slice(r * cols, (r + 1) * cols));
  }

  const isStampLikeCard = cardType === "stamp" || cardType === "cashback";
  const reward = (rewardText ?? "").trim();
  const firstName = (customerFirstName ?? "").trim();

  // Frame style : iOS arrondi 44px / notch large, Material 32px / petit dot.
  const isIos = platform === "apple";

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center justify-between w-full max-w-[300px] px-1">
        <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
          {isIos ? "Aperçu Apple Wallet" : "Aperçu Google Wallet"}
        </span>
      </div>
      <div className="relative w-full max-w-[300px]">
        <div
          className={cn(
            "relative p-3 shadow-2xl",
            isIos ? "bg-gray-900 rounded-[44px]" : "bg-gray-800 rounded-[32px]"
          )}
        >
          {/* Notch */}
          {isIos ? (
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
              isIos ? "rounded-[32px]" : "rounded-[22px]",
              isIos ? "bg-neutral-100" : "bg-[#0f1115]",
              "min-h-[560px]"
            )}
          >
            {/* Status bar */}
            <div
              className={cn(
                "flex items-center justify-between px-5 pt-2 pb-1 text-[10px] font-semibold",
                isIos ? "text-gray-900" : "text-gray-200"
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
                isIos ? "text-gray-900" : "text-gray-100"
              )}
            >
              <span className="text-[13px] font-semibold">
                {isIos ? "Cartes" : "Google Wallet"}
              </span>
              <div className="text-[11px] opacity-50">...</div>
            </div>

            {/* === The pass itself === */}
            <div className="px-3 pb-5 flex-1">
              <div
                className="rounded-[18px] overflow-hidden shadow-xl relative"
                style={{ backgroundColor: cardBg, color: onCardText }}
              >
                {/* 1. Header band : logo + (logoText/cardName) + headerField "TAMPONS X / Y". */}
                <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
                  {design.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={design.logo_url}
                      alt=""
                      className="w-8 h-8 rounded-md object-contain bg-transparent shrink-0"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-[13px] font-bold shrink-0"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.18)",
                        color: onCardText,
                      }}
                    >
                      {(headerTitle || "F").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[12px] font-semibold leading-tight truncate"
                      style={{ color: onCardText }}
                    >
                      {headerTitle}
                    </p>
                  </div>
                  {isStampLikeCard && (
                    <div className="text-right shrink-0">
                      <p
                        className="text-[8px] font-semibold tracking-wider uppercase leading-none"
                        style={{ color: labelColor }}
                      >
                        {cardType === "cashback"
                          ? design.label_stamps || "Visites"
                          : design.label_stamps || "Tampons"}
                      </p>
                      <p
                        className="text-[12px] font-bold mt-0.5"
                        style={{ color: onCardText }}
                      >
                        {stampsCollected} / {stampsTotal}
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Strip image : grille de tampons. */}
                {isStampLikeCard ? (
                  <div className="relative w-full" style={{ height: 92 }}>
                    {design.banner_url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={design.banner_url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-black/45" />
                      </>
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: cardBg, filter: "brightness(0.92)" }}
                      />
                    )}

                    <div className="relative z-10 h-full flex items-center justify-center">
                      <div
                        className="flex flex-col items-center justify-center"
                        style={{
                          gap: stripGap,
                          paddingLeft: stripHorizontalPadding,
                          paddingRight: stripHorizontalPadding,
                        }}
                      >
                        {rowsArr.map((row, r) => (
                          <div
                            key={r}
                            className="flex items-center justify-center"
                            style={{ gap: stripGap }}
                          >
                            {row.map((filled, idx) => (
                              <StripStamp
                                key={idx}
                                filled={filled}
                                size={stampSize}
                                shape={shape}
                                iconKey={iconKey}
                                accent={accentColor}
                                activeUrl={design.stamp_active_url ?? null}
                                inactiveUrl={design.stamp_inactive_url ?? null}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="relative w-full flex items-center gap-3 px-4 py-4"
                    style={{
                      backgroundColor: cardBg,
                      filter: design.banner_url ? undefined : "brightness(0.95)",
                    }}
                  >
                    {design.banner_url && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={design.banner_url}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-black/35 to-black/55" />
                      </>
                    )}
                    <div
                      className="relative z-10 h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                    >
                      {cardType === "discount" ? (
                        <Percent className="h-6 w-6" style={{ color: onCardText }} />
                      ) : cardType === "membership" ? (
                        <Crown className="h-6 w-6" style={{ color: onCardText }} />
                      ) : (
                        <CircleDollarSign
                          className="h-6 w-6"
                          style={{ color: onCardText }}
                        />
                      )}
                    </div>
                    <p
                      className="relative z-10 text-[13px] font-bold truncate"
                      style={{ color: onCardText }}
                    >
                      {reward || "À définir"}
                    </p>
                  </div>
                )}

                {/* 3. Fields row simplifiée :
                    - Apple : "Bonjour {firstName}" gauche / "Notre offre" droite
                    - Google : un seul textModule "Notre offre" pleine largeur
                      (Google ne sait pas faire 2 colonnes en haut). */}
                {isStampLikeCard && (
                  <div
                    className="px-3.5 pt-2 pb-3"
                    style={{ backgroundColor: cardBg }}
                  >
                    {isIos ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-[8px] font-semibold tracking-wider uppercase leading-none"
                            style={{ color: labelColor }}
                          >
                            Bonjour
                          </p>
                          <p
                            className="text-[11px] font-bold mt-1 truncate"
                            style={{ color: onCardText }}
                          >
                            {firstName || "—"}
                          </p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p
                            className="text-[8px] font-semibold tracking-wider uppercase leading-none"
                            style={{ color: labelColor }}
                          >
                            Notre offre
                          </p>
                          <p
                            className="text-[11px] font-bold mt-1 truncate"
                            style={{ color: onCardText }}
                            title={reward}
                          >
                            {reward || "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p
                          className="text-[8px] font-semibold tracking-wider uppercase leading-none"
                          style={{ color: labelColor }}
                        >
                          Notre offre
                        </p>
                        <p
                          className="text-[11px] font-bold mt-1 truncate"
                          style={{ color: onCardText }}
                          title={reward}
                        >
                          {reward || "—"}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. White card section : QR + "Propulsé par aswallet". */}
                <div className="bg-white px-4 py-3 flex flex-col items-center gap-1.5 border-t border-black/5">
                  {barcodeType === "qr" ? (
                    qrDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={qrDataUrl} alt="QR" className="w-24 h-24" />
                    ) : (
                      <div className="w-24 h-24 bg-gray-100 rounded animate-pulse" />
                    )
                  ) : (
                    <div className="w-full">
                      <Pdf417Visual value={sampleToken} />
                    </div>
                  )}
                  <span className="text-[9px] text-gray-500 tracking-wide">
                    Propulsé par aswallet
                  </span>
                </div>
              </div>

              <p
                className={cn(
                  "text-center text-[10px] mt-3",
                  isIos ? "text-gray-400" : "text-gray-500"
                )}
              >
                Glisser pour modifier · Double-taper pour les infos
              </p>
            </div>
          </div>

          {/* Home indicator (iOS only) */}
          {isIos && (
            <div className="flex justify-center mt-2">
              <div className="w-28 h-1 bg-gray-600 rounded-full" />
            </div>
          )}
        </div>
      </div>
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
  businessName,
  walletBusinessName,
  barcodeType = "qr",
  customerFirstName = "Sophie",
  platform = "both",
}: CardPreviewProps) {
  // Mode "single" : on rend un seul preview (utilisé par les pages publiques
  // et les modals où l'on veut juste l'iOS ou juste l'Android).
  if (platform === "apple" || platform === "google") {
    return (
      <SinglePreview
        platform={platform}
        cardName={cardName}
        stampCount={stampCount}
        rewardText={rewardText}
        collectedStamps={collectedStamps}
        design={design}
        cardType={cardType}
        businessName={businessName}
        walletBusinessName={walletBusinessName}
        barcodeType={barcodeType}
        customerFirstName={customerFirstName}
      />
    );
  }

  // Mode "both" (défaut éditeur) : UN SEUL mockup à taille pleine + toggle
  // pour switcher entre Apple Wallet et Google Wallet. Le tel s'affiche
  // entier (pas tronqué/coupé en deux). Le merchant clique pour comparer.
  return <ToggledPreview
    cardName={cardName}
    stampCount={stampCount}
    rewardText={rewardText}
    collectedStamps={collectedStamps}
    design={design}
    cardType={cardType}
    businessName={businessName}
    walletBusinessName={walletBusinessName}
    barcodeType={barcodeType}
    customerFirstName={customerFirstName}
  />;
}

function ToggledPreview({
  cardName,
  stampCount,
  rewardText,
  collectedStamps = 3,
  design,
  cardType = "stamp",
  businessName,
  walletBusinessName,
  barcodeType = "qr",
  customerFirstName = "Sophie",
}: Omit<CardPreviewProps, "platform">) {
  const [platform, setPlatform] = useState<"apple" | "google">("apple");
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="inline-flex items-center bg-gray-100 rounded-full p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setPlatform("apple")}
          className={cn(
            "px-4 py-1.5 rounded-full transition-colors cursor-pointer",
            platform === "apple"
              ? "bg-black text-white shadow-sm"
              : "text-gray-600 hover:text-black",
          )}
        >
          Apple Wallet
        </button>
        <button
          type="button"
          onClick={() => setPlatform("google")}
          className={cn(
            "px-4 py-1.5 rounded-full transition-colors cursor-pointer",
            platform === "google"
              ? "bg-black text-white shadow-sm"
              : "text-gray-600 hover:text-black",
          )}
        >
          Google Wallet
        </button>
      </div>
      <SinglePreview
        platform={platform}
        cardName={cardName}
        stampCount={stampCount}
        rewardText={rewardText}
        collectedStamps={collectedStamps}
        design={design}
        cardType={cardType}
        businessName={businessName}
        walletBusinessName={walletBusinessName}
        barcodeType={barcodeType}
        customerFirstName={customerFirstName}
      />
    </div>
  );
}
