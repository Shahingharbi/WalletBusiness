"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck, Sparkles, Crown, Store, MessageCircle, Gift } from "lucide-react";
import {
  PLANS,
  PLAN_ORDER,
  type PlanId,
  type BillingInterval,
} from "@/lib/billing";
import { emailHref, whatsappHref } from "@/lib/contact";

/**
 * Vente terrain : chaque offre mène à une prise de rendez-vous avec un
 * conseiller (installation en boutique) — WhatsApp en principal, email en
 * alternative. Message pré-rempli avec l'offre choisie.
 */
function bookingWhatsapp(planName: string): string {
  return whatsappHref(
    `Bonjour, je souhaite prendre rendez-vous pour l'offre ${planName} d'aswallet.`
  );
}

function bookingEmail(planName: string): string {
  return emailHref(
    `Rendez-vous aswallet — offre ${planName}`,
    `Bonjour,\n\nJe souhaite prendre rendez-vous pour l'offre ${planName}.\n\nNom du commerce :\nVille :\nTéléphone :\n`
  );
}

type Badge = {
  label: string;
  /**
   * Tailwind classes for the badge background + text. Kept hardcoded (no
   * dynamic class names) so Tailwind's JIT picks them up.
   */
  className: string;
  icon: React.ReactNode;
};

const PLAN_BADGES: Partial<Record<PlanId, Badge>> = {
  pro: {
    label: "Le plus choisi",
    className: "bg-yellow text-foreground",
    icon: <Sparkles size={12} className="text-foreground" />,
  },
  business: {
    label: "Jusqu'à 5 boutiques",
    className: "bg-green-600 text-white",
    icon: <Store size={12} className="text-white" />,
  },
  enterprise: {
    label: "Sur mesure",
    className: "bg-amber-300 text-amber-950",
    icon: <Crown size={12} className="text-amber-950" />,
  },
};

export function PricingSection() {
  // Défaut = mensuel : c'est le prix annoncé par le conseiller en boutique.
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");

  return (
    <section className="bg-white py-14 sm:py-20 lg:py-[86px]" id="pricing">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <h2
          className="text-center text-2xl sm:text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Des offres simples, installées chez vous
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Un conseiller vient dans votre boutique, crée votre carte et forme
          votre équipe. Sans engagement, sans frais cachés.
        </p>

        <div className="mt-8 flex justify-center">
          <div
            className="inline-flex rounded-full bg-beige p-1 text-sm"
            role="tablist"
            aria-label="Choix de la fréquence de facturation"
          >
            <button
              type="button"
              role="tab"
              aria-selected={billingInterval === "month"}
              onClick={() => setBillingInterval("month")}
              className={`px-5 py-2 rounded-full font-semibold transition-colors cursor-pointer ${
                billingInterval === "month"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billingInterval === "year"}
              onClick={() => setBillingInterval("year")}
              className={`px-5 py-2 rounded-full font-semibold transition-colors cursor-pointer ${
                billingInterval === "year"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annuel{" "}
              <span className="text-xs text-green-700 ml-1">−20 %</span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <span
            className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-1.5 text-sm font-semibold text-green-800"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            <Gift size={16} className="flex-shrink-0" />
            1er mois offert sur toutes les offres
          </span>
        </div>

        <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6 lg:gap-7">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const badge = PLAN_BADGES[planId];
            const isEnterprise = planId === "enterprise";
            const isHighlighted = planId === "pro";
            const isAnnual = billingInterval === "year";
            const displayPrice = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
            const yearlyTotal = plan.yearlyTotal;
            const yearlySaving =
              plan.monthlyPrice !== null && yearlyTotal !== null
                ? plan.monthlyPrice * 12 - yearlyTotal
                : null;

            return (
              <div
                key={planId}
                className={`relative flex flex-col rounded-2xl border-2 p-6 sm:p-7 transition-shadow duration-300 hover:shadow-xl ${
                  badge ? "pt-8 sm:pt-9" : ""
                } ${
                  isEnterprise
                    ? "border-amber-400 bg-gradient-to-br from-[#1a1208] via-[#231806] to-[#0d0905] text-amber-50"
                    : isHighlighted
                      ? "border-foreground shadow-lg md:scale-[1.02] bg-white"
                      : "border-border bg-white"
                }`}
              >
                {badge && (
                  <span
                    /* whitespace-nowrap : empêche le badge de wrapper et de
                       chevaucher le titre du plan sur Chrome.
                       max-w-[calc(100%-1rem)] : si la carte est plus étroite
                       que le badge (très rare en md+ mais arrive en mobile),
                       on tronque proprement plutôt que de déborder. */
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full whitespace-nowrap max-w-[calc(100%-1rem)] overflow-hidden text-ellipsis ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                )}

                <h3
                  className={`text-2xl font-semibold ${
                    isEnterprise ? "text-amber-100" : "text-foreground"
                  }`}
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  {plan.name}
                </h3>

                <p
                  className={`mt-1 text-xs ${
                    isEnterprise
                      ? "text-amber-200/80"
                      : "text-muted-foreground"
                  }`}
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  {plan.audience}
                </p>

                {/* Prices block */}
                <div className="mt-5 min-h-[68px]">
                  {isEnterprise ? (
                    <div>
                      <span
                        className="text-3xl text-amber-100"
                        style={{
                          fontFamily: "var(--font-ginto-nord)",
                          fontWeight: 500,
                        }}
                      >
                        Sur devis
                      </span>
                      <p className="text-xs text-amber-200/80 mt-1">
                        Selon le nombre de boutiques
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Prix barré sur sa propre ligne : à côté du prix
                          annuel, "/mois" passait à la ligne en 4 colonnes. */}
                      {isAnnual && plan.monthlyPrice !== null && (
                        <p className="text-sm text-muted-foreground line-through">
                          {plan.monthlyPrice}€/mois
                        </p>
                      )}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span
                          className="text-5xl lg:text-6xl text-foreground"
                          style={{
                            fontFamily: "var(--font-ginto-nord)",
                            fontWeight: 500,
                          }}
                        >
                          {displayPrice}€
                        </span>
                        <span className="text-base text-muted-foreground">
                          /mois
                        </span>
                      </div>
                      {isAnnual && yearlyTotal !== null ? (
                        <p className="text-xs text-green-700 mt-1">
                          Soit {yearlyTotal}€/an — {yearlySaving}€ économisés
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          ou {plan.yearlyPrice}€/mois en annuel
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    isEnterprise
                      ? "text-amber-100/90"
                      : "text-muted-foreground"
                  }`}
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  {plan.description}
                </p>

                <div className="mt-5 flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-2.5 items-start"
                      >
                        <Check
                          size={16}
                          className={`flex-shrink-0 mt-0.5 ${
                            isEnterprise
                              ? "text-amber-300"
                              : "text-green-600"
                          }`}
                        />
                        <span
                          className={`text-sm leading-snug ${
                            isEnterprise
                              ? "text-amber-50/95"
                              : "text-foreground"
                          }`}
                          style={{ fontFamily: "var(--font-maison-neue)" }}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={bookingWhatsapp(plan.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-7 w-full text-center rounded-full px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors min-h-[48px] inline-flex items-center justify-center gap-2 ${
                    isEnterprise
                      ? "bg-amber-300 text-amber-950 hover:bg-amber-200"
                      : isHighlighted
                        ? "bg-foreground text-white hover:bg-foreground/90"
                        : "bg-yellow text-foreground hover:bg-yellow-hover"
                  }`}
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  <MessageCircle size={18} />
                  {isEnterprise ? "Parler à un conseiller" : "Prendre rendez-vous"}
                </a>
                <a
                  href={bookingEmail(plan.name)}
                  className={`mt-2 text-center text-xs underline underline-offset-2 hover:opacity-70 ${
                    isEnterprise ? "text-amber-200/80" : "text-muted-foreground"
                  }`}
                >
                  ou par email
                </a>

                <p
                  className={`mt-3 text-center text-xs ${
                    isEnterprise ? "text-amber-200/80" : "text-muted-foreground"
                  }`}
                >
                  {isEnterprise ? (
                    "Étude personnalisée de votre réseau"
                  ) : (
                    <>
                      <span className="font-semibold text-green-700">
                        1er mois offert
                      </span>{" "}
                      · {isAnnual ? "Engagement 12 mois" : "Installation offerte"}
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border bg-beige/60 px-5 py-2.5 text-sm text-foreground text-center"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            <ShieldCheck size={16} className="text-green-600 flex-shrink-0" />
            <span>
              <strong className="font-semibold">
                Sans engagement sur l&apos;offre mensuelle.
              </strong>{" "}
              Résiliable à tout moment depuis votre tableau de bord.
            </span>
          </div>
          <Link
            href="#faq"
            className="text-sm font-semibold text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Une question ? Voir les questions fréquentes &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
