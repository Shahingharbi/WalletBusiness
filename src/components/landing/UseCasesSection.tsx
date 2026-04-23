import Link from "next/link";
import { ArrowRight } from "lucide-react";

type UseCase = {
  emoji: string;
  title: string;
  benefit: string;
  accent: string;
};

const cases: UseCase[] = [
  {
    emoji: "🥙",
    title: "Kebab & restauration rapide",
    benefit: "10 menus = 1 offert. Remplissez les creux entre midi et 14h.",
    accent: "bg-yellow/40",
  },
  {
    emoji: "🥐",
    title: "Boulangerie & cafe",
    benefit: "1 cafe offert apres 9 visites. Notifiez l'arrivee du pain chaud.",
    accent: "bg-amber-100",
  },
  {
    emoji: "💇",
    title: "Coiffeur & institut beaute",
    benefit: "-20% sur le 5e soin. Relancez les clientes dormantes en 1 clic.",
    accent: "bg-rose-100",
  },
  {
    emoji: "🍕",
    title: "Pizzeria & restaurant",
    benefit: "La 10e pizza offerte. Doublez les reservations du mardi soir.",
    accent: "bg-orange-100",
  },
  {
    emoji: "💐",
    title: "Fleuriste & epicerie",
    benefit: "Cashback fidelite. Rappel saisonnier : fete des meres, Saint-Valentin.",
    accent: "bg-emerald-100",
  },
  {
    emoji: "✨",
    title: "VIP & premium",
    benefit: "Carte privilege pour vos meilleurs clients. Acces anticipe aux offres.",
    accent: "bg-neutral-200",
  },
];

const DEMO_CARD_PATH = "/c/07d40ad7-e4f9-4c3b-8530-2c7627ce51df";

export function UseCasesSection() {
  return (
    <section className="bg-white py-20 lg:py-[86px]" id="use-cases">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="text-center max-w-2xl mx-auto">
          <span
            className="inline-block bg-yellow text-foreground text-xs font-bold px-3 py-1 rounded-full uppercase mb-5"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Par metier
          </span>
          <h2
            className="text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Une carte pensee pour votre commerce
          </h2>
          <p
            className="text-base text-muted-foreground mt-4"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Des mecaniques de fidelite qui marchent, adaptees a votre secteur.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((c) => (
            <div
              key={c.title}
              className="group flex flex-col rounded-2xl border border-border bg-white p-7 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
            >
              <div
                className={`w-14 h-14 rounded-2xl ${c.accent} flex items-center justify-center text-3xl mb-5`}
                aria-hidden
              >
                {c.emoji}
              </div>
              <h3
                className="text-lg lg:text-xl font-semibold text-foreground"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                {c.title}
              </h3>
              <p
                className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                {c.benefit}
              </p>
              <Link
                href={DEMO_CARD_PATH}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:gap-2.5 transition-all"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Voir un exemple
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        <p
          className="mt-10 text-center text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Un autre metier ?{" "}
          <a
            href="mailto:contact@aswallet.fr"
            className="font-semibold text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            On vous monte une demo sur mesure.
          </a>
        </p>
      </div>
    </section>
  );
}
