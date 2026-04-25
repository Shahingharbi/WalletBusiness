"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlanId, BillingInterval } from "@/lib/billing";

type Plan = {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  highlighted: boolean;
  badge?: string;
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 49,
    yearlyPrice: 39,
    description:
      "Idéal pour un commerce indépendant qui démarre sa fidélisation digitale.",
    features: [
      "1 carte de fidélité",
      "Jusqu'à 200 clients",
      "Scanner (webapp smartphone)",
      "Notifications push gratuites",
      "Dashboard avec statistiques",
      "QR code à imprimer",
      "Support par email",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 99,
    yearlyPrice: 79,
    description:
      "Pour les commerçants qui veulent aller plus loin avec la géolocalisation et la segmentation.",
    features: [
      "Jusqu'à 5 cartes de fidélité",
      "Jusqu'à 2 000 clients",
      "Tout le plan Starter +",
      "Statistiques avancées",
      "Notifications géolocalisées",
      "Segmentation clients",
      "Cartes cadeaux digitales",
      "Support prioritaire par chat",
    ],
    highlighted: true,
    badge: "Le + populaire",
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 199,
    yearlyPrice: 159,
    description:
      "Pour les réseaux et franchises qui ont besoin de puissance et de personnalisation.",
    features: [
      "Cartes illimitées",
      "Clients illimités",
      "Multi-employés",
      "Tout le plan Pro +",
      "API & webhooks",
      "Support prioritaire téléphone",
      "Marque blanche",
      "Account manager dédié",
    ],
    highlighted: false,
  },
];

export function PricingSection() {
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCta(plan: PlanId) {
    setError(null);
    setPending(plan);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/register?plan=${plan}&interval=${interval}`);
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
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
          Pas de frais cachés, pas d&apos;engagement.
        </p>

        <div className="mt-6 flex justify-center">
          <span
            className="inline-flex items-center gap-2 rounded-full bg-yellow px-4 py-2 text-sm font-semibold text-foreground"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            <Check size={16} /> 14 jours gratuits sur tous les plans &middot; Sans CB
          </span>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full bg-beige p-1 text-sm">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`px-5 py-2 rounded-full font-semibold transition-colors cursor-pointer ${
                interval === "month"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`px-5 py-2 rounded-full font-semibold transition-colors cursor-pointer ${
                interval === "year"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annuel{" "}
              <span className="text-xs text-green-700 ml-1">
                Économisez 20%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 max-w-md mx-auto rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
          {plans.map((plan) => {
            const price =
              interval === "year" ? plan.yearlyPrice : plan.monthlyPrice;
            const ctaLabel =
              plan.id === "starter"
                ? "Commencer en Starter"
                : plan.id === "pro"
                  ? "Choisir Pro"
                  : "Choisir Business";
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border-2 p-6 sm:p-8 transition-shadow duration-300 hover:shadow-xl ${
                  plan.highlighted
                    ? "border-foreground shadow-lg md:scale-[1.02]"
                    : "border-border"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow text-foreground text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}

                <h3
                  className="text-2xl font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  {plan.name}
                </h3>

                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className="text-5xl lg:text-6xl text-foreground"
                    style={{
                      fontFamily: "var(--font-ginto-nord)",
                      fontWeight: 500,
                    }}
                  >
                    {price}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    EUR/mois
                  </span>
                </div>
                {interval === "year" && (
                  <p className="text-xs text-green-700 mt-1">
                    Facturé annuellement ({price * 12} EUR/an)
                  </p>
                )}

                <p
                  className="mt-3 text-sm text-muted-foreground leading-relaxed"
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  {plan.description}
                </p>

                <div className="mt-6 flex-1">
                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex gap-3 items-start"
                      >
                        <Check
                          size={16}
                          className="text-green-600 flex-shrink-0 mt-0.5"
                        />
                        <span
                          className="text-sm text-foreground"
                          style={{ fontFamily: "var(--font-maison-neue)" }}
                        >
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCta(plan.id)}
                  disabled={pending !== null}
                  className={`mt-8 w-full block text-center rounded-full px-6 py-3.5 text-sm sm:text-base font-semibold transition-colors min-h-[48px] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                    plan.highlighted
                      ? "bg-foreground text-white hover:bg-foreground/90"
                      : "bg-yellow text-foreground hover:bg-yellow-hover"
                  }`}
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  {pending === plan.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Redirection…
                    </>
                  ) : (
                    ctaLabel
                  )}
                </button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  14 jours sans engagement, sans carte bancaire
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border bg-beige/60 px-5 py-2.5 text-sm text-foreground"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            <ShieldCheck size={16} className="text-green-600" />
            <span>
              <strong className="font-semibold">
                Essai 14 jours sans engagement.
              </strong>{" "}
              Résiliable en 1 clic, à tout moment.
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
