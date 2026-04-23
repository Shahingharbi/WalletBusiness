import { Plus } from "lucide-react";

type FAQ = {
  q: string;
  a: string;
};

const faqs: FAQ[] = [
  {
    q: "Et si mon client n'a pas de smartphone ou pas Apple Wallet ?",
    a: "Plus de 95% des smartphones en France (Android et iPhone) ont Apple Wallet ou Google Wallet preinstalle. Pour les rares cas sans wallet, le client peut toujours recevoir un lien qui s'ouvre dans son navigateur, ou vous pouvez garder une carte papier en parallele pour ces clients. Vous ne perdez personne.",
  },
  {
    q: "Est-ce complique a installer pour mes employes ?",
    a: "Non. Il n'y a rien a installer sur votre caisse. Vos employes ouvrent simplement la webapp aswallet sur leur smartphone ou une tablette, scannent le QR code du client, et le tampon est ajoute. Formation : 2 minutes.",
  },
  {
    q: "Combien de temps pour rentabiliser l'abonnement ?",
    a: "Le plan Starter a 49 EUR/mois est rentabilise des que 2 a 3 clients reviennent dans le mois grace a une notification push. La plupart des commerces voient un effet des la premiere offre flash envoyee.",
  },
  {
    q: "Puis-je resilier a tout moment ?",
    a: "Oui. Pas d'engagement, pas de frais de resiliation. Vous arretez votre abonnement en 1 clic depuis votre tableau de bord. Vos donnees restent exportables pendant 30 jours.",
  },
  {
    q: "Mes donnees et celles de mes clients sont-elles en securite ?",
    a: "Oui. Hebergement en France et en Europe (conforme RGPD), chiffrement SSL/TLS de bout en bout, aucune revente de donnees, jamais. Vous restez proprietaire de votre liste clients et pouvez l'exporter a tout moment.",
  },
  {
    q: "Apple Wallet ou Google Wallet, lequel choisir ?",
    a: "Les deux. Quand un client ajoute votre carte, on detecte automatiquement son telephone : iPhone = Apple Wallet, Android = Google Wallet. Vous n'avez rien a faire, vous avez un seul outil pour les deux.",
  },
  {
    q: "Vous remplacez ma caisse enregistreuse ?",
    a: "Non, et c'est volontaire. aswallet vit a cote de votre caisse actuelle. Vous gardez votre logiciel de caisse, votre TPE, vos habitudes. On ajoute juste un scan QR pour la fidelite, rien d'autre.",
  },
  {
    q: "Comment mes clients installent la carte ?",
    a: "Vous imprimez une affiche avec un QR code (fournie dans l'outil). Le client scanne avec son appareil photo, sa carte s'ajoute a Apple Wallet ou Google Wallet en 2 clics. Aucune app a telecharger, aucun compte a creer.",
  },
];

export function FAQSection() {
  return (
    <section className="bg-beige py-20 lg:py-[86px]" id="faq">
      <div className="mx-auto max-w-[880px] px-6">
        <h2
          className="text-center text-3xl lg:text-[40px] lg:leading-[48px] font-semibold"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Questions frequentes
        </h2>
        <p
          className="text-center text-base text-muted-foreground mt-4 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Les reponses aux questions qu&apos;on nous pose tous les jours.
        </p>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-border bg-white overflow-hidden"
            >
              <summary
                className="flex items-center justify-between gap-4 cursor-pointer select-none px-6 py-5 list-none hover:bg-beige/60 transition-colors"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                <span className="text-base lg:text-lg font-semibold text-foreground">
                  {faq.q}
                </span>
                <Plus
                  size={20}
                  className="text-foreground flex-shrink-0 transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <div
                className="px-6 pb-5 pt-1 text-sm lg:text-base text-muted-foreground leading-relaxed"
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
