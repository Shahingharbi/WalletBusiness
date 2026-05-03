"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, Sparkles, Crown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PLANS,
  PLAN_ORDER,
  toBillingIntervalAlias,
  type PlanId,
  type BillingInterval,
} from "@/lib/billing";

const ENTERPRISE_MAILTO =
  "mailto:contact@aswallet.fr?subject=Demande%20Enterprise%20aswallet";

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
    label: "Meilleur rapport qualité/prix",
    className: "bg-green-600 text-white",
    icon: <Check size={12} className="text-white" />,
  },
  enterprise: {
    label: "Sur mesure",
    className: "bg-amber-300 text-amber-950",
    icon: <Crown size={12} className="text-amber-950" />,
  },
};

export function PricingSection() {
  const router = useRouter();
  // Default = annual (proven higher LTV / better cash flow).
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("year");
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStripePlanCta(plan: Exclude<PlanId, "enterprise">) {
    setError(null);
    setPending(plan);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const intervalAlias = toBillingIntervalAlias(billingInterval);

      if (!user) {
        router.push(`/register?plan=${plan}&interval=${intervalAlias}`);
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur lors du checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPending(null);
    }
  }

  return (
    <section className="bg-white py-14 sm:py-20 lg:py-[86px]" id="pricing">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <h2
          className="text-center text-2xl sm:text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Des tarifs simples et transparents
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Pas de frais cachés, pas d&apos;engagement. 30 jours d&apos;essai
          gratuit, sans carte bancaire.
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
              <span className="text-xs text-green-700 ml-1">
                Économisez 25 %
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 max-w-md mx-auto rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6 lg:gap-7">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const badge = PLAN_BADGES[planId];
            const isEnterprise = planId === "enterprise";
            const isHighlighted = planId === "pro";
            const isAnnual = billingInterval === "year";
            const displayPrice = isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
            const yearlyTotal = plan.yearlyTotal;

            return (
              <div
                key={planId}
                className={`relative flex flex-col rounded-2xl border-2 p-6 sm:p-7 transition-shadow duration-300 hover:shadow-xl ${
                  isEnterprise
                    ? "border-amber-400 bg-gradient-to-br from-[#1a1208] via-[#231806] to-[#0d0905] text-amber-50"
                    : isHighlighted
                      ? "border-foreground shadow-lg md:scale-[1.02] bg-white"
                      : "border-border bg-white"
                }`}
              >
                {badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${badge.className}`}
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
                        À partir de ~300€/mois
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {isAnnual && plan.monthlyPrice !== null && (
                          <span className="text-xl text-muted-foreground line-through">
                            {plan.monthlyPrice}€
                          </span>
                        )}
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
                          Soit {yearlyTotal}€/an — 3 mois offerts (économie
                          25 %)
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          ou {plan.yearlyPrice}€/mois en annuel — économisez
                          25 %
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

                {isEnterprise ? (
                  <a
                    href={ENTERPRISE_MAILTO}
                    className="mt-7 w-full block text-center rounded-full px-6 py-3.5 text-sm sm:text-base font-semibold transition-colors min-h-[48px] inline-flex items-center justify-center bg-amber-300 text-amber-950 hover:bg-amber-200"
                    style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                  >
                    Contacter les ventes
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStripePlanCta(planId)}
                    disabled={pending !== null}
                    className={`mt-7 w-full block text-center rounded-full px-6 py-3.5 text-sm sm:text-base font-semibold transition-colors min-h-[48px] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                      isHighlighted
                        ? "bg-foreground text-white hover:bg-foreground/90"
                        : "bg-yellow text-foreground hover:bg-yellow-hover"
                    }`}
                    style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                  >
                    {pending === planId ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Redirection…
                      </>
                    ) : (
                      "Démarrer l'essai gratuit"
                    )}
                  </button>
                )}

                {!isEnterprise && (
                  <p
                    className={`mt-3 text-center text-xs ${
                      isHighlighted
                        ? "text-muted-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    30 jours d&apos;essai gratuit · Sans carte bancaire ·
                    Annulation en 1 clic
                  </p>
                )}
                {isEnterprise && (
                  <p className="mt-3 text-center text-xs text-amber-200/80">
                    Réponse sous 24h ouvrées · Démo personnalisée
                  </p>
                )}
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
                Garantie satisfait ou remboursé 30 jours après paiement.
              </strong>{" "}
              Résiliation en 1 clic, sans question.
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
