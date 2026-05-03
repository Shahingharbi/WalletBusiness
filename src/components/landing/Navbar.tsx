"use client";

import Link from "next/link";

export function Navbar({ bannerVisible }: { bannerVisible: boolean }) {
  return (
    <header
      className="sticky z-40 bg-white rounded-b-2xl transition-shadow duration-300"
      style={{
        top: bannerVisible ? 52 : 0,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <nav className="mx-auto flex h-[60px] sm:h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 gap-3">
        <Link
          href="/"
          className="flex-shrink-0 text-xl sm:text-2xl font-bold text-foreground tracking-tight"
          style={{ fontFamily: "var(--font-ginto-nord)" }}
        >
          aswallet
        </Link>

        <div className="hidden lg:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Fonctionnalités
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Comment ça marche
          </a>
          <a
            href="#pricing"
            className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Tarifs
          </a>
          <a
            href="#contact"
            className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Contact
          </a>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="hidden sm:block text-sm text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Se connecter
          </Link>
          <Link
            href="/#pricing"
            className="rounded-full bg-yellow px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-yellow-hover transition-colors whitespace-nowrap"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            <span className="hidden sm:inline">Essayer gratuitement</span>
            <span className="sm:hidden">Essai gratuit</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
