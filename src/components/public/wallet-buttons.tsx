"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "other";

interface WalletButtonsProps {
  instanceToken: string;
  appleWalletAvailable: boolean;
  googleWalletAvailable: boolean;
}

/**
 * Wallet add buttons. Detects the platform from `navigator.userAgent` and
 * only renders the relevant button:
 *   - iOS (iPhone, iPad)        → Apple Wallet only
 *   - Android                   → Google Wallet only
 *   - Other (desktop, etc.)     → Both, so demos still work
 *
 * SSR safe: defaults to "other" (show both) on the initial render to avoid
 * hydration mismatches, then narrows to one platform inside `useEffect`.
 */
export function WalletButtons({
  instanceToken,
  appleWalletAvailable,
  googleWalletAvailable,
}: WalletButtonsProps) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!appleWalletAvailable && !googleWalletAvailable) return null;

  // Decide which buttons to show. If the relevant wallet is not configured
  // server-side, fall back to whatever is configured so the user is never
  // blocked.
  const showApple =
    appleWalletAvailable &&
    (platform === "ios" || platform === "other" || !googleWalletAvailable);
  const showGoogle =
    googleWalletAvailable &&
    (platform === "android" || platform === "other" || !appleWalletAvailable);

  return (
    <div className="flex flex-col gap-3 items-center">
      {showApple && (
        <a
          href={`/api/apple-wallet/${instanceToken}`}
          className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-5 h-12 rounded-full hover:bg-gray-900 transition-colors"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Ajouter à Apple Wallet
        </a>
      )}
      {showGoogle && (
        <a
          href={`/api/google-wallet/${instanceToken}`}
          className="inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-5 h-12 rounded-full hover:bg-gray-900 transition-colors"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5l-3.5-3.5L9 11.5l2 2 4-4 1.5 1.5-5.5 5.5z" />
          </svg>
          Ajouter à Google Wallet
        </a>
      )}
      <p className="text-[10px] text-gray-400 text-center">
        {platform === "ios"
          ? "Compatible avec votre iPhone."
          : platform === "android"
            ? "Compatible avec votre Android."
            : appleWalletAvailable && googleWalletAvailable
              ? "Compatible iPhone + Android."
              : appleWalletAvailable
                ? "Disponible sur iPhone. Sur Android, ajoutez cette page à votre écran d'accueil."
                : "Disponible sur Android. Sur iPhone, ajoutez cette page à votre écran d'accueil."}
      </p>
    </div>
  );
}

/**
 * Detect the platform from `navigator.userAgent`. Treats iPadOS 13+ (which
 * masquerades as desktop Safari) as iOS via the touch-points heuristic.
 */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";

  if (/android/i.test(ua)) return "android";

  // iOS — iPhone, iPod, classic iPad UA, plus iPadOS 13+ which reports as
  // "Macintosh" but has touch support.
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  const isIPadOS =
    typeof navigator !== "undefined" &&
    /Macintosh/.test(ua) &&
    "maxTouchPoints" in navigator &&
    (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1;
  if (isIPadOS) return "ios";

  return "other";
}
