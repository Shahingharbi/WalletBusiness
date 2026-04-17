import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "49",
    description: "Ideal pour un commerce independant qui demarre sa fidelisation digitale.",
    features: [
      "1 point de vente",
      "Carte de fidelite personnalisee",
      "Scanner app (webapp smartphone)",
      "Notifications push gratuites et illimitees",
      "Dashboard avec statistiques",
      "QR code a imprimer",
      "Support par email",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "99",
    description: "Pour les commercants qui veulent aller plus loin avec la geolocalisation et la segmentation.",
    features: [
      "Jusqu'a 5 points de vente",
      "Tout le plan Starter +",
      "Statistiques avancees",
      "Notifications geolocalisees",
      "Segmentation clients",
      "Cartes cadeaux digitales",
      "Support prioritaire par chat",
    ],
    highlighted: true,
    badge: "Populaire",
  },
  {
    name: "Business",
    price: "199",
    description: "Pour les reseaux et franchises qui ont besoin de puissance et de personnalisation.",
    features: [
      "Points de vente illimites",
      "Tout le plan Pro +",
      "API & webhooks",
      "Integrations caisse (sur demande)",
      "Support prioritaire telephone",
      "Marque blanche",
      "Account manager dedie",
    ],
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section className="bg-white py-20 lg:py-[86px]" id="pricing">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Des tarifs simples et transparents
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Pas de frais caches, pas d&apos;engagement. Essayez gratuitement pendant 14 jours.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border-2 p-8 transition-shadow duration-300 hover:shadow-xl ${
                plan.highlighted ? "border-foreground shadow-lg scale-[1.02]" : "border-border"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow text-foreground text-xs font-bold px-4 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}

              <h3 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl lg:text-6xl text-foreground" style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}>
                  {plan.price}
                </span>
                <span className="text-lg text-muted-foreground">EUR/mois</span>
              </div>

              <p className="mt-3 text-sm text-muted-foreground leading-relaxed" style={{ fontFamily: "var(--font-maison-neue)" }}>
                {plan.description}
              </p>

              <div className="mt-6 flex-1">
                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 items-start">
                      <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground" style={{ fontFamily: "var(--font-maison-neue)" }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/register"
                className={`mt-8 block text-center rounded-full px-6 py-3.5 text-base font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-foreground text-white hover:bg-foreground/90"
                    : "bg-yellow text-foreground hover:bg-yellow-hover"
                }`}
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Essayer gratuitement
              </Link>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                14 jours sans engagement, sans carte bancaire
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
