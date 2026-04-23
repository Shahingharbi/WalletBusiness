import { Plus } from "lucide-react";

type FAQ = {
  q: string;
  a: string;
};

const faqs: FAQ[] = [
  {
    q: "Et si mon client n'a pas de smartphone ou pas Apple Wallet ?",
    a: "Plus de 95% des smartphones en France (Android et iPhone) ont Apple Wallet ou Google Wallet préinstallé. Pour les rares cas sans wallet, le client peut toujours recevoir un lien qui s'ouvre dans son navigateur, ou vous pouvez garder une carte papier en parallèle pour ces clients. Vous ne perdez personne.",
  },
  {
    q: "Est-ce compliqué à installer pour mes employés ?",
    a: "Non. Il n'y a rien à installer sur votre caisse. Vos employés ouvrent simplement la webapp aswallet sur leur smartphone ou une tablette, scannent le QR code du client, et le tampon est ajouté. Formation : 2 minutes.",
  },
  {
    q: "Combien de temps pour rentabiliser l'abonnement ?",
    a: "Le plan Starter à 49 EUR/mois est rentabilisé dès que 2 à 3 clients reviennent dans le mois grâce à une notification push. La plupart des commerces voient un effet dès la première offre flash envoyée.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: "Oui. Pas d'engagement, pas de frais de résiliation. Vous arrêtez votre abonnement en 1 clic depuis votre tableau de bord. Vos données restent exportables pendant 30 jours.",
  },
  {
    q: "Mes données et celles de mes clients sont-elles en sécurité ?",
    a: "Oui. Hébergement en France et en Europe (conforme RGPD), chiffrement SSL/TLS de bout en bout, aucune revente de données, jamais. Vous restez propriétaire de votre liste clients et pouvez l'exporter à tout moment.",
  },
  {
    q: "Apple Wallet ou Google Wallet, lequel choisir ?",
    a: "Les deux. Quand un client ajoute votre carte, on détecte automatiquement son téléphone : iPhone = Apple Wallet, Android = Google Wallet. Vous n'avez rien à faire, vous avez un seul outil pour les deux.",
  },
  {
    q: "Vous remplacez ma caisse enregistreuse ?",
    a: "Non, et c'est volontaire. aswallet vit à côté de votre caisse actuelle. Vous gardez votre logiciel de caisse, votre TPE, vos habitudes. On ajoute juste un scan QR pour la fidélité, rien d'autre.",
  },
  {
    q: "Comment mes clients installent la carte ?",
    a: "Vous imprimez une affiche avec un QR code (fournie dans l'outil). Le client scanne avec son appareil photo, sa carte s'ajoute à Apple Wallet ou Google Wallet en 2 clics. Aucune app à télécharger, aucun compte à créer.",
  },
];

export function FAQSection() {
  return (
    <section className="bg-beige py-14 sm:py-20 lg:py-[86px]" id="faq">
      <div className="mx-auto max-w-[880px] px-4 sm:px-6">
        <h2
          className="text-center text-2xl sm:text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Questions fréquentes
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Les réponses aux questions qu&apos;on nous pose tous les jours.
        </p>

        <div className="mt-8 sm:mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-border bg-white overflow-hidden"
            >
              <summary
                className="flex items-center justify-between gap-3 sm:gap-4 cursor-pointer select-none px-4 sm:px-6 py-4 sm:py-5 list-none hover:bg-beige/60 transition-colors min-h-[56px]"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                <span className="text-sm sm:text-base lg:text-lg font-semibold text-foreground">
                  {faq.q}
                </span>
                <Plus
                  size={20}
                  className="text-foreground flex-shrink-0 transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <div
                className="px-4 sm:px-6 pb-5 pt-1 text-sm lg:text-base text-muted-foreground leading-relaxed"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        <p
          className="mt-10 text-center text-sm text-muted-foreground"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Une autre question ?{" "}
          <a
            href="mailto:contact@aswallet.fr"
            className="font-semibold text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            contact@aswallet.fr
          </a>
        </p>
      </div>
    </section>
  );
}
