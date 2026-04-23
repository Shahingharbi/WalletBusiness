import { X, Check } from "lucide-react";

type Row = {
  paper: string;
  wallet: string;
};

const rows: Row[] = [
  {
    paper: "Perdue par 60% des clients en moins d'un an",
    wallet: "Jamais perdue : stockee dans Apple / Google Wallet",
  },
  {
    paper: "Oubliee au moment de payer",
    wallet: "Toujours dans la poche, notifiee a proximite",
  },
  {
    paper: "Impossible de contacter un client fidele",
    wallet: "Notifications push gratuites et illimitees",
  },
  {
    paper: "Impression, tampons, cartes perdues : cout cache",
    wallet: "0 impression, 0 materiel, 0 stock",
  },
  {
    paper: "Aucune donnee, aucune statistique",
    wallet: "Tableau de bord temps reel : scans, retention, CA",
  },
  {
    paper: "Zero personnalisation par client",
    wallet: "Segmentation & offres ciblees par habitude",
  },
];

export function WhyWalletSection() {
  return (
    <section className="bg-white py-20 lg:py-[86px]" id="why-wallet">
      <div className="mx-auto max-w-[1280px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold max-w-3xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Carte papier vs carte aswallet
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-2xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Le papier n&apos;a pas change depuis 30 ans. Vos clients, si.
          Voici ce qu&apos;ils attendent aujourd&apos;hui.
        </p>

        <div className="mt-12 lg:mt-16 rounded-2xl border border-border overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-2 bg-beige">
            <div className="px-5 lg:px-8 py-5 border-r border-border">
              <p
                className="text-xs lg:text-sm font-semibold text-red-500 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Carte papier
              </p>
            </div>
            <div className="px-5 lg:px-8 py-5 bg-yellow/40">
              <p
                className="text-xs lg:text-sm font-semibold text-foreground uppercase tracking-wider"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Carte aswallet
              </p>
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-2 border-t border-border"
            >
              <div className="px-5 lg:px-8 py-5 border-r border-border flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X size={14} className="text-red-500" />
                </div>
                <p
                  className="text-sm lg:text-base text-foreground/70"
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  {row.paper}
                </p>
              </div>
              <div className="px-5 lg:px-8 py-5 flex gap-3 items-start bg-white">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={14} className="text-green-600" />
                </div>
                <p
                  className="text-sm lg:text-base text-foreground font-semibold"
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  {row.wallet}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p
          className="mt-8 text-center text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          La carte papier n&apos;est pas cassee. Elle est juste depassee.
        </p>
      </div>
    </section>
  );
}
