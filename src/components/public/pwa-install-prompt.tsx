"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android-chrome" | "desktop" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "aswallet:pwa-prompt-dismissed";

/**
 * Sheet "Ajoutez sur votre écran d'accueil".
 *
 * Pourquoi : sans Apple Pay (Algérie + tous les pays sans le service paiement),
 * l'iPhone ne supporte pas le double-clic side-button pour sortir Apple Wallet.
 * Le client doit donc fouiller son tel pour montrer sa carte au commerçant —
 * mauvaise expérience. Avec une icône PWA installée, **un seul tap = QR plein
 * écran**, peu importe la région ou le téléphone.
 *
 * Stratégie d'affichage :
 *  - Caché si `display-mode: standalone` (déjà installé)
 *  - Caché si dismissé en localStorage
 *  - Sinon : sheet bottom apparaît après 4s sur le visit (laisser le client
 *    voir d'abord la carte/QR), avec dismiss manuel
 *  - iOS : instructions Share → "Sur l'écran d'accueil"
 *  - Android Chrome : appelle `prompt()` du `beforeinstallprompt` event
 *  - Desktop / autres : fallback "Pas dispo" (rare cas de visit desktop)
 */
export function PwaInstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);
  const [show, setShow] = useState(false);
  const [deferredEvt, setDeferredEvt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS standalone API
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    ) {
      setInstalled(true);
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => setShow(true), 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  if (installed || !show) return null;

  const dismiss = () => {
    setShow(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  };

  const triggerNativePrompt = async () => {
    if (!deferredEvt) return;
    await deferredEvt.prompt();
    await deferredEvt.userChoice;
    dismiss();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-prompt-title"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pointer-events-none"
    >
      <div className="mx-auto max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-5 pointer-events-auto animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shrink-0">
            <svg
              className="h-7 w-7 text-amber-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="pwa-prompt-title"
              className="text-base font-bold text-gray-900"
            >
              Sortez votre carte en 1 clic
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Ajoutez la carte à votre écran d&apos;accueil pour la montrer au
              commerçant en un seul appui.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1 rounded-full"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-4">
          {platform === "ios" ? <IosInstructions /> : null}
          {platform === "android-chrome" ? (
            <AndroidPrompt
              hasNative={Boolean(deferredEvt)}
              onClick={triggerNativePrompt}
            />
          ) : null}
          {platform === "desktop" || platform === "other" ? (
            <DesktopHint />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IosInstructions() {
  return (
    <ol className="space-y-2 text-sm text-gray-700">
      <li className="flex items-start gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-bold shrink-0 mt-0.5">
          1
        </span>
        <span>
          Touchez l&apos;icône{" "}
          <span className="inline-flex h-5 w-5 items-center justify-center align-middle text-gray-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>{" "}
          Partager (en bas de Safari)
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-bold shrink-0 mt-0.5">
          2
        </span>
        <span>
          Choisissez{" "}
          <strong>« Sur l&apos;écran d&apos;accueil »</strong>
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-bold shrink-0 mt-0.5">
          3
        </span>
        <span>Validez. Une icône apparaît, prête à l&apos;emploi.</span>
      </li>
    </ol>
  );
}

function AndroidPrompt({
  hasNative,
  onClick,
}: {
  hasNative: boolean;
  onClick: () => void;
}) {
  if (hasNative) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-full bg-gray-900 text-white font-semibold text-sm py-3 hover:bg-gray-800 transition-colors"
      >
        Installer sur mon téléphone
      </button>
    );
  }
  return (
    <ol className="space-y-2 text-sm text-gray-700">
      <li className="flex items-start gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-bold shrink-0 mt-0.5">
          1
        </span>
        <span>Ouvrez le menu Chrome (⋮ en haut à droite)</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white text-[11px] font-bold shrink-0 mt-0.5">
          2
        </span>
        <span>
          Choisissez <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>
        </span>
      </li>
    </ol>
  );
}

function DesktopHint() {
  return (
    <p className="text-sm text-gray-700">
      Pour une utilisation au quotidien, ouvrez cette page sur votre téléphone
      et ajoutez-la à votre écran d&apos;accueil.
    </p>
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";

  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  const isIPadOS =
    /Macintosh/.test(ua) &&
    "maxTouchPoints" in navigator &&
    (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1;
  if (isIPadOS) return "ios";

  if (/Android/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/SamsungBrowser/i.test(ua))
      return "android-chrome";
    // Samsung Internet, Firefox Android etc — instructions générales
    return "android-chrome";
  }

  if (/Macintosh|Windows|Linux/i.test(ua)) return "desktop";
  return "other";
}
