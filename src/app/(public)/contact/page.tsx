import type { Metadata } from "next";
import { Mail, MapPin, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'équipe aswallet pour toute question.",
};

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1
        className="text-3xl sm:text-4xl font-bold mb-3 text-center"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Contact
      </h1>
      <p className="text-center text-muted-foreground mb-8 sm:mb-12">
        Une question, un problème avec votre carte de fidélité ? Nous vous répondons sous 48h.
      </p>

      <div className="space-y-4">
        <a
          href="mailto:contact@aswallet.fr"
          className="flex items-center gap-4 p-5 rounded-2xl border border-beige-dark hover:border-foreground transition-colors group"
        >
          <div className="h-12 w-12 rounded-full bg-yellow flex items-center justify-center shrink-0">
            <Mail className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Email
            </p>
            <p className="text-muted-foreground text-sm group-hover:text-foreground transition-colors">
              contact@aswallet.fr
            </p>
          </div>
        </a>

        <div className="flex items-center gap-4 p-5 rounded-2xl border border-beige-dark">
          <div className="h-12 w-12 rounded-full bg-beige-dark flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Éditeur
            </p>
            <p className="text-muted-foreground text-sm">
              Shahin Gharbi (entreprise individuelle)
            </p>
            <p className="text-muted-foreground text-xs">
              SIRET : 903 950 210 00026
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-5 rounded-2xl border border-beige-dark">
          <div className="h-12 w-12 rounded-full bg-beige-dark flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p
              className="font-semibold text-foreground"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Adresse postale
            </p>
            <p className="text-muted-foreground text-sm">
              443 Rue des Combes
              <br />
              73000 Chambéry, France
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 sm:mt-12 p-5 sm:p-6 rounded-2xl bg-beige border border-beige-dark text-center">
        <p
          className="font-semibold text-foreground mb-1"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Vous êtes commerçant ?
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Découvrez comment aswallet peut fidéliser vos clients en 5 minutes.
        </p>
        <a
          href="/register"
          className="inline-flex rounded-full bg-yellow text-foreground font-semibold px-6 py-2.5 text-sm hover:bg-yellow-hover transition-colors"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Essayer gratuitement
        </a>
      </div>
    </div>
  );
}
