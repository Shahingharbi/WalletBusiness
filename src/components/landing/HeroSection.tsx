"use client";

import Link from "next/link";
import { ArrowRight, Smartphone, Star, Clock } from "lucide-react";

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
              Vos clients reviennent,
              <br />
              directement depuis leur{" "}
              <span className="bg-yellow px-2 rounded-md">wallet</span>.
            </h1>

            <p
              className="text-sm sm:text-base lg:text-xl leading-relaxed lg:leading-[30px] max-w-[560px] mt-5 sm:mt-6 text-foreground"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              La carte de fidélité digitale pensée pour les kebabs, boulangeries,
              pizzerias, instituts et fleuristes. Zéro app à télécharger, zéro
              matériel : un QR code sur votre comptoir, et vos clients
              l&apos;ajoutent à Apple Wallet ou Google Wallet en 2&nbsp;clics.
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

          <div className="flex-1 flex flex-col items-center justify-center order-1 lg:order-2 w-full">
            <div className="relative w-full max-w-[360px] sm:max-w-[400px] mx-auto">
              <div className="relative mx-auto w-[240px] sm:w-[280px] lg:w-[320px] max-w-full aspect-[9/16] rounded-[40px] bg-gradient-to-br from-neutral-900 to-neutral-700 p-3 shadow-2xl">
                <div className="w-full h-full rounded-[32px] bg-white overflow-hidden flex flex-col">
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-20 h-5 bg-black rounded-full" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
                    <div className="w-full rounded-2xl bg-gradient-to-br from-yellow to-yellow-hover p-5 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center">
                          <Smartphone size={20} className="text-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground/60 uppercase">
                            Carte de fidélité
                          </p>
                          <p className="text-sm font-bold text-foreground">Mon Commerce</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-foreground/60">Tampons</p>
                          <p
                            className="text-2xl font-bold text-foreground"
                            style={{ fontFamily: "var(--font-ginto-nord)" }}
                          >
                            6 / 8
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div
                              key={i}
                              className={`w-5 h-5 rounded-full border-2 ${
                                i <= 6
                                  ? "bg-foreground border-foreground"
                                  : "border-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-foreground/60 text-center">
                        Encore 2 achats pour votre récompense !
                      </div>
                    </div>

                    <div className="w-full rounded-xl bg-beige border border-border p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-yellow flex-shrink-0 flex items-center justify-center mt-0.5">
                          <span className="text-[10px] font-bold">AS</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            Mon Commerce
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Offre flash ! -20% aujourd&apos;hui sur votre menu préféré
                          </p>
                        </div>
                        <span className="text-[9px] text-muted-foreground flex-shrink-0">
                          2min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stat chips */}
              <div className="hidden lg:block absolute -left-6 top-12 bg-white rounded-2xl px-4 py-3 shadow-xl border border-border">
                <p
                  className="text-2xl text-foreground leading-none"
                  style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
                >
                  90%
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  de taux de lecture<br />des push wallet
                </p>
              </div>
              <div className="hidden lg:flex absolute -right-4 bottom-16 bg-foreground rounded-2xl px-4 py-3 shadow-xl items-center gap-2">
                <Clock size={18} className="text-yellow" />
                <div>
                  <p className="text-xs font-bold text-white">Prêt en 5 min</p>
                  <p className="text-[10px] text-white/60">Sans développeur</p>
                </div>
              </div>
            </div>
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
