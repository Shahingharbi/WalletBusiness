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

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-40 rounded-xl bg-white border border-gray-200 shadow-lg px-4 py-3 flex items-start gap-3"
    >
      <p className="text-xs text-gray-700 leading-relaxed flex-1">
        Ce site utilise uniquement des cookies techniques necessaires a votre
        connexion. Aucun tracking, aucune publicite.
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
