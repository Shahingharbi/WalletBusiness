"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function TopBanner({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black text-white h-[52px] flex items-center justify-center px-10 sm:px-6">
      <p
        className="text-sm font-semibold tracking-tight hidden sm:block"
        style={{ fontFamily: "var(--font-maison-neue-extended)" }}
      >
        Essai gratuit 30 jours, sans engagement, sans carte bancaire
      </p>
      <p
        className="text-xs font-semibold tracking-tight sm:hidden"
        style={{ fontFamily: "var(--font-maison-neue-extended)" }}
      >
        30 jours gratuits
      </p>
      <Link
        href="/#pricing"
        className="ml-3 sm:ml-6 border border-white rounded-full px-3 sm:px-6 py-1.5 text-xs sm:text-sm text-white hover:bg-white hover:text-black transition-colors duration-200 whitespace-nowrap"
      >
        Commencer
      </Link>
      <button
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        className="absolute right-2 sm:right-6 text-white hover:opacity-70 transition-opacity cursor-pointer p-2"
        aria-label="Fermer la bannière"
      >
        <X size={16} />
      </button>
    </div>
  );
}
