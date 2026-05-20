"use client";

import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { HeroMockup } from "./HeroMockup";

const avatarSeeds = ["Karim", "Amelie", "Mehdi", "Sophie", "Jules"];

export function HeroSection() {
  return (
    <section className="bg-beige overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-20 pb-10 sm:pb-16">
        <div className="flex flex-col lg:flex-row gap-10 sm:gap-12 lg:gap-8">
          <div className="flex-1 flex flex-col justify-center order-2 lg:order-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
              <span className="bg-yellow text-foreground text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full uppercase">
                Offre de lancement
              </span>
              <span
                className="text-xs sm:text-sm text-foreground"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                1 mois gratuit en plus pour les 50 premiers
              </span>
            </div>

            <h1
              className="text-[30px] sm:text-[40px] lg:text-[58px] leading-[1.08] lg:leading-[66px]"
              style={{
                fontFamily: "var(--font-ginto-nord)",
                fontWeight: 500,
              }}
            >
              Transformez vos clients{" "}
              <span className="bg-yellow px-2 rounded-md">occasionnels</span>
              <br />
              en clients habitués.
            </h1>

            <p
              className="text-sm sm:text-base lg:text-xl leading-relaxed lg:leading-[30px] max-w-[560px] mt-5 sm:mt-6 text-foreground"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Aidez vos clients à revenir plus souvent grâce à un système de
              fidélisation pensé pour les commerces de proximité. Zéro app à
              télécharger, zéro matériel : un QR code sur votre comptoir, et
              vos clients l&apos;ajoutent à Apple Wallet ou Google Wallet en
              2&nbsp;clics.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
              <Link
                href="/#pricing"
                className="rounded-full bg-foreground px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-semibold text-white hover:bg-foreground/90 transition-colors text-center inline-flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Lancer ma carte en 5 minutes
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/demo"
                className="rounded-full border border-foreground/20 bg-white px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-semibold text-foreground hover:border-foreground transition-colors text-center inline-flex items-center justify-center gap-2 min-h-[48px]"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Tester maintenant (sans compte)
              </Link>
            </div>

            <p
              className="mt-4 text-sm text-foreground/60"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              30 jours d&apos;essai sans carte bancaire &middot; Sans engagement &middot; Résiliable en 1 clic
            </p>

            {/* Social proof: avatar stack */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="flex -space-x-2">
                {avatarSeeds.map((seed) => (
                  <img
                    key={seed}
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      seed
                    )}&backgroundColor=fff382,ffe94d,f9f7f0&fontFamily=Arial`}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 border-beige bg-white max-w-full"
                  />
                ))}
              </div>
              <div
                className="text-sm text-foreground/80"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                <span className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      className="text-foreground"
                      fill="currentColor"
                    />
                  ))}
                  <span className="ml-1 font-semibold text-foreground">4,8/5</span>
                </span>
                <span className="text-xs text-foreground/60">
                  Déjà utilisé par des commerçants en France
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center order-1 lg:order-2 w-full">
            <HeroMockup />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pb-14 sm:pb-20">
        <p
          className="text-center text-sm sm:text-base font-semibold mb-6 sm:mb-10"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Pour tous les commerces de proximité
        </p>
        <div
          className="flex flex-wrap justify-center gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-4 text-muted-foreground text-xs sm:text-sm"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          {[
            "Kebabs & tacos",
            "Boulangeries",
            "Pizzerias",
            "Salons de coiffure",
            "Barbiers",
            "Instituts de beauté",
            "Cafés & bars",
            "Pressing",
            "Fleuristes",
            "Épiceries",
          ].map((name) => (
            <span key={name} className="hover:text-foreground transition-colors">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
