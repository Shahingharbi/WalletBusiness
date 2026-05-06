"use client";

import { useEffect, useState } from "react";

/**
 * Cookie notice — informational only.
 *
 * aswallet uses ONLY strictly-necessary authentication cookies (Supabase
 * session). CNIL guidance (art. 82 de la loi Informatique et Libertes)
 * dispenses strictly-necessary cookies from consent, so no consent banner
 * is required. This small dismissible notice is shown once for transparency.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("cookies-notice-dismissed");
      if (!dismissed) {
        // Delay slightly so it doesn't fight with initial paint
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable (SSR / privacy mode) — stay hidden
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem("cookies-notice-dismissed", "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  // Position : bottom-RIGHT (pas bottom-center) pour ne pas masquer les
  // CTAs / formulaires / QR codes du contenu central. Largeur plafonnée à
  // 320px et padding dans `env(safe-area-inset-bottom)` pour ne pas chevaucher
  // les nav bottom iPhone. Accents français corrigés.
  return (
    <div
      role="status"
      className="fixed bottom-3 right-3 z-40 max-w-[320px] rounded-xl bg-white border border-gray-200 shadow-lg px-3 py-2.5 flex items-start gap-2 pb-[max(env(safe-area-inset-bottom),10px)]"
    >
      <p className="text-[11px] text-gray-700 leading-snug flex-1">
        Cookies techniques uniquement. Aucun tracking, aucune publicité.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
