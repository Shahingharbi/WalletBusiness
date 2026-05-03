import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HowItWorksSection() {
  return (
    <section className="px-6 py-6" id="how-it-works">
      <div className="mx-auto max-w-[1280px] rounded-[20px] bg-beige px-8 lg:px-12 py-16 lg:py-[86px]">
        <div className="text-center max-w-2xl mx-auto">
          <span
            className="inline-block bg-foreground text-white text-xs font-bold px-3 py-1 rounded-full uppercase mb-5"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            En 3 étapes
          </span>
          <h2
            className="text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            De zéro à opérationnel en 5 minutes
          </h2>
          <p
            className="text-base text-muted-foreground mt-4"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Aucun matériel requis. Aucune intégration caisse. Aucun développeur.
          </p>
        </div>

        <div className="relative mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {/* Horizontal dashed connector behind the cards (desktop only) */}
          <div
            aria-hidden
            className="hidden md:block absolute top-6 left-[16.66%] right-[16.66%] h-px border-t-2 border-dashed border-foreground/20"
          />

          {/* Step 1 */}
          <div className="relative flex flex-col items-center text-center">
            <div className="relative z-10 w-12 h-12 rounded-full bg-foreground flex items-center justify-center mb-6 shadow-md ring-4 ring-beige">
              <span
                className="text-white text-lg font-bold"
                style={{ fontFamily: "var(--font-ginto-nord)" }}
              >
                1
              </span>
            </div>

            <div className="w-full aspect-[4/3] rounded-2xl bg-white border border-border shadow-sm overflow-hidden mb-6">
              <div className="bg-foreground px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-white/60 text-[10px] ml-2">aswallet.fr</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-yellow" />
                  <span className="text-xs font-semibold text-foreground">
                    Ma carte de fidélité
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground w-14 text-right">
                      Nom
                    </span>
                    <div className="flex-1 h-5 rounded bg-beige border border-border px-2 flex items-center">
                      <span className="text-[9px] text-foreground">Ma Boulangerie</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground w-14 text-right">
                      Couleur
                    </span>
                    <div className="flex gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-yellow border-2 border-foreground" />
                      <div className="w-5 h-5 rounded-full bg-blue-500" />
                      <div className="w-5 h-5 rounded-full bg-red-500" />
                      <div className="w-5 h-5 rounded-full bg-green-500" />
                      <div className="w-5 h-5 rounded-full bg-purple-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground w-14 text-right">
                      Règle
                    </span>
                    <div className="flex-1 h-5 rounded bg-beige border border-border px-2 flex items-center">
                      <span className="text-[9px] text-foreground">10 tampons = 1 offert</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-gradient-to-r from-yellow to-yellow-hover p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold text-foreground">Ma Boulangerie</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i <= 3 ? "bg-foreground" : "border border-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground bg-yellow px-2.5 py-1 rounded-full mb-3">
              5 min
            </span>
            <h3
              className="text-xl lg:text-2xl font-semibold"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Créez votre carte
            </h3>
            <p
              className="mt-3 text-base text-muted-foreground leading-relaxed max-w-sm"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Logo, couleurs, règle de fidélité (tampons, points ou cashback).
              Personnalisation en 3 clics.
            </p>

            {/* Mobile arrow */}
            <div className="md:hidden mt-6 mb-2 text-foreground/40">
              <ArrowRight size={24} className="rotate-90" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center text-center">
            <div className="relative z-10 w-12 h-12 rounded-full bg-foreground flex items-center justify-center mb-6 shadow-md ring-4 ring-beige">
              <span
                className="text-white text-lg font-bold"
                style={{ fontFamily: "var(--font-ginto-nord)" }}
              >
                2
              </span>
            </div>

            <div className="w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-border overflow-hidden mb-6 flex items-center justify-center relative">
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-stone-200 to-stone-100" />
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl p-3 shadow-lg z-10">
                <div className="grid grid-cols-5 gap-0.5 w-12 h-12">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-[1px] ${
                        [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 19, 20, 22, 23, 24].includes(i)
                          ? "bg-foreground"
                          : "bg-white"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[6px] text-center text-muted-foreground mt-1">
                  Scannez-moi
                </p>
              </div>
              <div className="relative z-20 -mt-4 w-16 h-28 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-600 p-1 shadow-xl transform -rotate-6">
                <div className="w-full h-full rounded-lg bg-white flex flex-col items-center justify-center">
                  <div className="w-3 h-3 rounded bg-blue-400 mb-1" />
                  <div className="w-8 h-1 rounded bg-gray-200 mb-0.5" />
                  <div className="w-6 h-1 rounded bg-gray-200" />
                  <div className="mt-2 text-[5px] font-bold text-green-600">Ajouté !</div>
                </div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-blue-300/30 rounded-lg" />
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground bg-yellow px-2.5 py-1 rounded-full mb-3">
              2 clics
            </span>
            <h3
              className="text-xl lg:text-2xl font-semibold"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Imprimez le QR en boutique
            </h3>
            <p
              className="mt-3 text-base text-muted-foreground leading-relaxed max-w-sm"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Vos clients scannent avec leur appareil photo. La carte s&apos;ajoute à
              Apple Wallet ou Google Wallet. Sans app, sans compte.
            </p>

            <div className="md:hidden mt-6 mb-2 text-foreground/40">
              <ArrowRight size={24} className="rotate-90" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center text-center">
            <div className="relative z-10 w-12 h-12 rounded-full bg-yellow flex items-center justify-center mb-6 shadow-md ring-4 ring-beige">
              <span
                className="text-foreground text-lg font-bold"
                style={{ fontFamily: "var(--font-ginto-nord)" }}
              >
                3
              </span>
            </div>

            <div className="w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-border overflow-hidden mb-6 p-4 flex flex-col gap-2.5">
              <div className="bg-white rounded-xl p-3 shadow-sm flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-yellow flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold">FP</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-foreground">
                      Ma Pizzeria
                    </span>
                    <span className="text-[8px] text-muted-foreground">maintenant</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Votre 10e pizza est offerte ! Venez la récupérer
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-3 shadow-sm flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px]">&#128205;</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-foreground">
                      Salon Élégance
                    </span>
                    <span className="text-[8px] text-muted-foreground">2min</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Vous êtes à 50m ! -15% aujourd&apos;hui sur les soins
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-3 shadow-sm mt-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-semibold text-foreground">
                    Cette semaine
                  </span>
                  <span className="text-[9px] text-green-600 font-semibold">+24%</span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-yellow to-yellow-hover"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[7px] text-muted-foreground">Lun</span>
                  <span className="text-[7px] text-muted-foreground">Dim</span>
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground bg-yellow px-2.5 py-1 rounded-full mb-3">
              Gratuit & illimité
            </span>
            <h3
              className="text-xl lg:text-2xl font-semibold"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Fidélisez et relancez
            </h3>
            <p
              className="mt-3 text-base text-muted-foreground leading-relaxed max-w-sm"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Notifications push gratuites, stats en temps réel, offres
              géolocalisées. Vos clients reviennent.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mt-14">
          <Link
            href="/#pricing"
            className="rounded-full bg-foreground px-8 py-3.5 text-base font-semibold text-white hover:bg-foreground/90 transition-colors inline-flex items-center gap-2 shadow-lg"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Démarrer maintenant
            <ArrowRight size={18} />
          </Link>
          <p
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            30 jours gratuits &middot; Sans CB &middot; Sans engagement
          </p>
        </div>
      </div>
    </section>
  );
}
