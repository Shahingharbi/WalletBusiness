"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Sticky bottom CTA for mobile only.
 * Appears once user has scrolled past the hero (~600px).
 * Pure CSS + scroll listener.
 *
 * TODO: exit-intent popup for desktop — defer, too heavy for now.
 */
export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 bg-beige/95 backdrop-blur border-t border-border transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
    >
      <Link
        href="/#pricing"
        className="w-full flex items-center justify-center gap-2 rounded-full bg-foreground text-white px-6 py-3.5 text-sm font-semibold shadow-lg"
        style={{ fontFamily: "var(--font-maison-neue-extended)" }}
      >
        Essayer gratuitement 30 jours
        <ArrowRight size={16} />
      </Link>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        Sans CB &middot; Annulable à tout moment
      </p>
    </div>
  );
}
