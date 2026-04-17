"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";

const stats = [
  { value: "37,8M", label: "de cartes wallet actives en France", source: "Ifop 2025" },
  { value: "90%", label: "de taux de lecture des notifications push", source: "Mediametrie" },
  { value: "67%", label: "de depenses en plus par les clients fideles", source: "Semrush" },
];

export function HeroSection() {
  const [currentStat, setCurrentStat] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % stats.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="bg-beige">
      <div className="mx-auto max-w-[1280px] px-6 pt-20 pb-16">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-8">
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-8">
              <span className="bg-yellow text-foreground text-xs font-bold px-3 py-1 rounded-full uppercase">
                Nouveau
              </span>
              <span
                className="text-sm text-foreground"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                La fidelite client, reinventee
              </span>
            </div>

            <h1
              className="text-[36px] lg:text-[60px] leading-[1.15] lg:leading-[72px]"
              style={{
                fontFamily: "var(--font-ginto-nord)",
                fontWeight: 500,
                whiteSpace: "pre-line",
              }}
            >
              {"Vos clients\nreviennent.\nVotre CA\ndecolle."}
            </h1>

            <p
              className="text-base lg:text-xl leading-relaxed lg:leading-[30px] max-w-[540px] mt-6 text-foreground"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Creez une carte de fidelite digitale dans Apple Wallet et Google Wallet.
              Vos clients l&apos;ajoutent en 2 clics, sans app a telecharger.
              Envoyez des notifications push gratuites et illimitees.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link
                href="/register"
                className="rounded-full bg-yellow px-8 py-3.5 text-base font-semibold text-foreground hover:bg-yellow-hover transition-colors text-center"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Essayer gratuitement
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-foreground px-8 py-3.5 text-base font-semibold text-foreground hover:bg-foreground hover:text-white transition-colors text-center inline-flex items-center justify-center gap-2"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Voir comment ca marche
                <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-full max-w-[400px]">
              <div className="relative mx-auto w-[280px] lg:w-[320px] aspect-[9/16] rounded-[40px] bg-gradient-to-br from-neutral-900 to-neutral-700 p-3 shadow-2xl">
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
                            Carte de fidelite
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
                        Encore 2 achats pour votre recompense !
                      </div>
                    </div>

                    <div className="w-full rounded-xl bg-beige border border-border p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-yellow flex-shrink-0 flex items-center justify-center mt-0.5">
                          <span className="text-[10px] font-bold">FP</span>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">
                            Mon Commerce
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Offre flash ! -20% aujourd&apos;hui sur votre menu prefere
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
            </div>

            <div className="relative w-full max-w-[400px] mt-8">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="absolute inset-0 transition-opacity duration-500 flex items-center justify-center"
                  style={{
                    opacity: currentStat === index ? 1 : 0,
                    position: index === 0 ? "relative" : "absolute",
                  }}
                >
                  <div className="bg-foreground rounded-2xl p-5 w-full text-center">
                    <p
                      className="text-white text-3xl lg:text-4xl"
                      style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
                    >
                      {stat.value}
                    </p>
                    <p className="text-white/80 text-sm mt-1">{stat.label}</p>
                    <p className="text-white/50 text-xs mt-1">Source : {stat.source}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-4 justify-center">
                {stats.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStat(index)}
                    className={`w-3 h-3 rounded-full transition-colors cursor-pointer ${
                      currentStat === index ? "bg-foreground" : "bg-border"
                    }`}
                    aria-label={`Statistique ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 pb-20">
        <p
          className="text-center text-base font-semibold mb-10"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Pour tous les commerces de proximite
        </p>
        <div
          className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-muted-foreground text-sm"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          {[
            "Restaurants",
            "Fast-food & Tacos",
            "Boulangeries",
            "Pizzerias",
            "Salons de coiffure",
            "Instituts de beaute",
            "Bars & Cafes",
            "Salles de sport",
            "Commerces alimentaires",
            "Boutiques",
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
