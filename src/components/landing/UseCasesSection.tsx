import Link from "next/link";
import { ArrowRight } from "lucide-react";

type UseCase = {
  title: string;
  tagline: string;
  benefit: string;
  image: string;
  ctaLabel: string;
  badge: string;
};

// Unsplash photos — vérifiées 200 OK, produits uniquement (pas de visage, pas d'awra).
// Aucun chiffre marketing inventé : on décrit la mécanique, pas un résultat.
const cases: UseCase[] = [
  {
    title: "Kebab & restauration rapide",
    tagline: "10 menus = 1 offert",
    benefit:
      "Remplissez les creux du midi. Notifiez vos habitués des plats du jour.",
    image:
      "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=900&auto=format&fit=crop&q=70",
    ctaLabel: "Démarrer gratuitement",
    badge: "Tampons illimités",
  },
  {
    title: "Boulangerie & café",
    tagline: "9 visites = 1 café offert",
    benefit:
      "Fidélisez vos clients du matin. Notifications push pour le pain chaud.",
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&auto=format&fit=crop&q=70",
    ctaLabel: "Démarrer gratuitement",
    badge: "Notifs gratuites",
  },
  {
    title: "Coiffeur & institut beauté",
    tagline: "-20% sur le 5e soin",
    benefit:
      "Relancez vos clientes dormantes en 1 clic, sans SMS payant.",
    image:
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=900&auto=format&fit=crop&q=70",
    ctaLabel: "Démarrer gratuitement",
    badge: "Relances en 1 clic",
  },
  {
    title: "Pizzeria & restaurant",
    tagline: "La 10e pizza offerte",
    benefit:
      "Animez vos soirs creux : envoyez une promo ciblée à votre base.",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&auto=format&fit=crop&q=70",
    ctaLabel: "Démarrer gratuitement",
    badge: "Campagnes ciblées",
  },
  {
    title: "Fleuriste & épicerie",
    tagline: "Cashback fidélité",
    benefit:
      "Rappels automatiques : fête des mères, Saint-Valentin. Jamais manquer un pic.",
    image:
      "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=900&auto=format&fit=crop&q=70",
    ctaLabel: "Démarrer gratuitement",
    badge: "Rappels saisonniers",
  },
  {
    title: "VIP & premium",
    tagline: "Carte privilège",
    benefit:
      "Réservez votre meilleur tarif à vos meilleurs clients. Accès anticipé aux offres.",
    image:
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=900&auto=format&fit=crop&q=70",
    ctaLabel: "Démarrer gratuitement",
    badge: "Carte privilège",
  },
];

export function UseCasesSection() {
  return (
    <section className="bg-beige py-14 sm:py-20 lg:py-[86px]" id="use-cases">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <span
            className="inline-block bg-yellow text-foreground text-xs font-bold px-3 py-1 rounded-full uppercase mb-5"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Par métier
          </span>
          <h2
            className="text-2xl sm:text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Pour tous les commerces de proximité
          </h2>
          <p
            className="text-base text-muted-foreground mt-4"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Des mécaniques de fidélité qui marchent, adaptées à votre secteur.
          </p>
        </div>

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cases.map((c) => (
            <Link
              key={c.title}
              href="/#pricing"
              className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative h-44 sm:h-52 lg:h-56 overflow-hidden">
                <img
                  src={c.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span
                    className="inline-block bg-white/95 backdrop-blur text-foreground text-[11px] font-bold px-3 py-1.5 rounded-full"
                    style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                  >
                    {c.badge}
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <p
                    className="text-yellow text-xs font-bold uppercase tracking-wider mb-1"
                    style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                  >
                    {c.tagline}
                  </p>
                  <h3
                    className="text-white text-xl font-semibold leading-tight"
                    style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                  >
                    {c.title}
                  </h3>
                </div>
              </div>

              <div className="flex flex-col flex-1 p-5 sm:p-6">
                <p
                  className="text-sm text-muted-foreground leading-relaxed flex-1"
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  {c.benefit}
                </p>
                <div
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:gap-2.5 transition-all"
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  {c.ctaLabel}
                  <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p
          className="mt-12 text-center text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Un autre métier ?{" "}
          <a
            href="mailto:contact@aswallet.fr"
            className="font-semibold text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            On vous monte une démo sur mesure.
          </a>
        </p>
      </div>
    </section>
  );
}
