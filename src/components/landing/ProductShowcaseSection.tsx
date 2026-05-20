import Image from "next/image";

/**
 * Showcase produit : dashboard merchant + scanner caissier rendus dans
 * de vrais frames (laptop + iPhone). Captures prises sur aswallet.fr
 * en compte test via Playwright (scripts/screen-landing.mjs).
 *
 * Pourquoi : la LP n'avait que des mockups CSS de carte wallet. Le
 * prospect ne voyait pas l'OUTIL qu'il aura entre les mains (dashboard
 * pour le pilotage, scanner pour le caissier). Cette section comble ça.
 */
export function ProductShowcaseSection() {
  return (
    <section className="bg-beige py-16 sm:py-24 lg:py-32" id="produit">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <span
            className="inline-block bg-yellow text-foreground text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase mb-4"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Le produit
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-foreground leading-tight"
            style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
          >
            Un outil simple à utiliser{" "}
            <span className="bg-yellow px-2 rounded-md">au quotidien</span>.
          </h2>
          <p
            className="mt-5 text-base sm:text-lg text-foreground/70 max-w-2xl mx-auto"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Côté patron, un tableau de bord qui suit votre fidélité en temps
            réel. Côté caissier, un scanner qui valide un tampon en 3 secondes,
            sans formation.
          </p>
        </div>

        {/* DASHBOARD — frame laptop */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-16 sm:mb-24">
          <div className="order-2 lg:order-1">
            <h3
              className="text-2xl sm:text-3xl text-foreground leading-tight"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              Votre tableau de bord, en temps réel.
            </h3>
            <p
              className="mt-4 text-base text-foreground/70 leading-relaxed"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Clients qui reviennent, scans du jour, top cartes, activité
              récente. Vous voyez ce qui marche, et ce qu&apos;il faut
              relancer — sans Excel, sans rien à compter à la main.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Nombre de clients actifs en direct",
                "Filtres : aujourd'hui, 7 jours, 30 jours, 12 mois",
                "Top des cartes les plus scannées",
                "Comparaison automatique période précédente",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-foreground"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 lg:order-2 relative">
            {/* Mac-style laptop frame */}
            <div className="relative mx-auto max-w-[680px]">
              <div className="rounded-t-2xl bg-neutral-800 p-2 shadow-2xl">
                <div className="rounded-t-xl bg-neutral-900 overflow-hidden">
                  {/* Mac chrome bar */}
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800/60">
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  {/* Screenshot */}
                  <Image
                    src="/landing-mockups/dashboard-desktop.png"
                    alt="Tableau de bord aswallet"
                    width={1440}
                    height={900}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
              {/* Laptop base */}
              <div className="mx-auto h-3 bg-gradient-to-b from-neutral-700 to-neutral-900 rounded-b-2xl" style={{ width: "108%", marginLeft: "-4%" }} />
              <div className="mx-auto h-1 bg-neutral-800 rounded-b-xl" style={{ width: "30%" }} />
            </div>
          </div>
        </div>

        {/* SCANNER — frame iPhone */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="relative order-1">
            {/* iPhone frame */}
            <div className="relative mx-auto w-[260px] sm:w-[300px]">
              <div className="rounded-[42px] bg-neutral-900 p-2.5 shadow-2xl ring-1 ring-black/20">
                <div className="relative rounded-[34px] overflow-hidden bg-black">
                  {/* Dynamic Island */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-24 h-6 bg-black rounded-full" />
                  <Image
                    src="/landing-mockups/scanner-mobile.png"
                    alt="Scanner caissier aswallet"
                    width={414}
                    height={896}
                    className="w-full h-auto"
                  />
                </div>
              </div>
              {/* Floating "Valider" tag */}
              <div className="absolute -right-2 sm:-right-6 top-1/3 bg-emerald-500 text-black rounded-2xl px-4 py-3 shadow-xl ring-1 ring-emerald-300 rotate-3">
                <p className="text-xs font-bold leading-tight">3 secondes</p>
                <p className="text-[10px] leading-tight">pour valider</p>
              </div>
            </div>
          </div>

          <div className="order-2">
            <h3
              className="text-2xl sm:text-3xl text-foreground leading-tight"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              Le scanner du caissier, ultra simple.
            </h3>
            <p
              className="mt-4 text-base text-foreground/70 leading-relaxed"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Caméra, scan du QR, validation. Pas de formation, pas de
              matériel, pas de logiciel à installer. N&apos;importe quel
              téléphone ou tablette fait l&apos;affaire.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Scan caméra ou saisie manuelle en backup",
                "Choix du nombre de tampons en 1 tap",
                "Carte du client mise à jour automatiquement",
                "Marche sur n'importe quel smartphone ou tablette",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-foreground"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-foreground"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
