import { X, Check } from "lucide-react";

const problems = [
  {
    problem: "Les cartes papier se perdent",
    detail: "79% des consommateurs preferent un programme sans carte physique.",
    source: "Ebbo",
  },
  {
    problem: "Les apps ne sont jamais telechargees",
    detail: "Seulement 25% des apps telechargees sont utilisees plus d'une fois.",
    source: "Localytics",
  },
  {
    problem: "Le SMS coute cher",
    detail: "0,01 a 0,05 EUR par SMS. Les couts explosent avec le volume.",
    source: "Mobiloud",
  },
  {
    problem: "L'email finit en spam",
    detail: "Seulement 20% de taux d'ouverture en moyenne.",
    source: "Mobiloud",
  },
];

const solutionPoints = [
  "Apple Wallet et Google Wallet sont preinstalles sur tous les smartphones",
  "0 telechargement, 0 compte a creer, 0 friction",
  "90% de taux de lecture des notifications push",
  "Notifications push gratuites et illimitees",
  "85 a 95% des cartes wallet ne sont jamais supprimees",
];

export function WhyWalletSection() {
  return (
    <section className="bg-white py-20 lg:py-[86px]" id="why-wallet">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold max-w-3xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Pourquoi le wallet mobile ?
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-2xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Les methodes traditionnelles de fidelisation ne fonctionnent plus.
          Le wallet mobile change la donne.
        </p>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <div>
            <h3
              className="text-lg font-semibold text-red-500 mb-8 uppercase tracking-wider"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Ce qui ne marche plus
            </h3>
            <div className="space-y-6">
              {problems.map((item) => (
                <div key={item.problem} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p
                      className="text-base font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                    >
                      {item.problem}
                    </p>
                    <p
                      className="text-sm text-muted-foreground mt-1"
                      style={{ fontFamily: "var(--font-maison-neue)" }}
                    >
                      {item.detail}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Source : {item.source}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3
              className="text-lg font-semibold text-green-600 mb-8 uppercase tracking-wider"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              La solution wallet mobile
            </h3>
            <div className="rounded-2xl bg-beige p-8">
              <p
                className="text-xl font-semibold text-foreground mb-6"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Deja dans le telephone de vos clients
              </p>
              <div className="space-y-4">
                {solutionPoints.map((point) => (
                  <div key={point} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={14} className="text-green-600" />
                    </div>
                    <p
                      className="text-base text-foreground"
                      style={{ fontFamily: "var(--font-maison-neue)" }}
                    >
                      {point}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Sources : Mediametrie, Ifop/Captain Wallet 2025, PassKit, Mobiloud
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
