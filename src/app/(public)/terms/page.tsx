import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions generales d'utilisation",
  description:
    "Conditions generales d'utilisation du service FidPass.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Conditions generales d&apos;utilisation
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Derniere mise a jour : 18 avril 2026
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. Editeur</h2>
      <p>
        FidPass est un service edite par Shahin Gharbi (entreprise individuelle,
        SIRET 903 950 210 00026), 443 Rue des Combes, 73000 Chambery, France.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">2. Objet</h2>
      <p>
        FidPass permet aux commercants de creer et gerer des cartes de fidelite
        digitales pour leurs clients. Les clients finals utilisent ces cartes via
        un navigateur web, Google Wallet ou Apple Wallet.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Acces au service</h2>
      <p>
        Le service est accessible 24h/24, 7j/7, sauf interruption pour maintenance.
        Nous ne garantissons pas une disponibilite ininterrompue. Aucune indemnite
        ne pourra etre reclamee en cas d&apos;indisponibilite temporaire.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">4. Compte commercant</h2>
      <p>
        Le commercant s&apos;engage a fournir des informations exactes lors de
        l&apos;inscription, a maintenir la confidentialite de ses identifiants,
        et a notifier immediatement toute utilisation non autorisee de son compte.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">5. Utilisation client final</h2>
      <p>
        L&apos;installation d&apos;une carte de fidelite est gratuite pour le client
        final. Aucun paiement ne lui est demande. Les recompenses sont gerees
        directement par le commercant emetteur de la carte.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">6. Tarification commercant</h2>
      <p>
        L&apos;abonnement commercant est facture mensuellement. Les tarifs
        sont indiques sur notre page Tarifs. Toute resiliation prend effet a la
        fin de la periode payee.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">7. Donnees personnelles</h2>
      <p>
        Le traitement des donnees personnelles est decrit dans notre{" "}
        <a href="/privacy" className="underline">Politique de confidentialite</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">8. Propriete intellectuelle</h2>
      <p>
        Le design, le code, les marques et logos de FidPass sont proteges par le
        droit d&apos;auteur. Toute reproduction non autorisee est interdite.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">9. Responsabilite</h2>
      <p>
        FidPass agit en qualite d&apos;hebergeur technique. Le contenu des cartes
        de fidelite (nom, design, recompense) est sous la responsabilite exclusive
        du commercant emetteur. FidPass ne peut etre tenu responsable des
        engagements pris par les commercants envers leurs clients.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Loi applicable</h2>
      <p>
        Les presentes CGU sont soumises au droit francais. Tout litige relevera
        de la competence des tribunaux de Chambery.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact</h2>
      <p>
        Pour toute question :{" "}
        <a href="mailto:contact@fidpass.fr" className="underline">contact@fidpass.fr</a>
      </p>
    </div>
  );
}
