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
      <nav className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex-shrink-0 text-2xl font-bold text-foreground tracking-tight"
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
            Fonctionnalites
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Comment ca marche
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

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden sm:block text-sm text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Se connecter
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-yellow px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-yellow-hover transition-colors"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Essayer gratuitement
          </Link>
        </div>
      </nav>
    </header>
  );
}
