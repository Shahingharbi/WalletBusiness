import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions generales d'utilisation",
  description:
    "Conditions generales d'utilisation du service aswallet.",
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
        Derniere mise a jour : 23 avril 2026
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. Editeur</h2>
      <p>
        aswallet est un service edite par Shahin Gharbi (entreprise
        individuelle, SIRET 903 950 210 00026), 443 Rue des Combes, 73000
        Chambery, France. Contact :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        . Les mentions legales completes sont disponibles sur la page{" "}
        <a href="/mentions-legales" className="underline">
          Mentions legales
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">2. Objet</h2>
      <p>
        aswallet permet aux commercants (ci-apres &laquo; le Commercant &raquo;)
        de creer et gerer des cartes de fidelite digitales pour leurs clients
        finals (ci-apres &laquo; le Client &raquo;). Les Clients utilisent ces
        cartes via un navigateur web, Google Wallet ou Apple Wallet.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Acces au service</h2>
      <p>
        Le service est accessible 24h/24, 7j/7, sauf interruption pour
        maintenance. aswallet ne garantit pas une disponibilite ininterrompue
        et s&apos;engage a deployer les meilleurs efforts pour maintenir le
        service. Aucune indemnite ne pourra etre reclamee en cas
        d&apos;indisponibilite temporaire.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">4. Compte commercant</h2>
      <p>
        Le Commercant s&apos;engage a fournir des informations exactes lors de
        l&apos;inscription, a maintenir la confidentialite de ses identifiants,
        et a notifier immediatement aswallet de toute utilisation non
        autorisee de son compte.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        5. Utilisation par le client final
      </h2>
      <p>
        L&apos;installation d&apos;une carte de fidelite est gratuite pour le
        Client. Aucun paiement ne lui est demande. Les recompenses associees a
        la carte sont attribuees et honorees directement par le Commercant
        emetteur, sous sa seule responsabilite.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Tarification commercant
      </h2>
      <p>
        L&apos;abonnement commercant est facture mensuellement ou annuellement
        selon la formule choisie. Les tarifs sont indiques sur la page Tarifs
        du site. Toute resiliation prend effet a la fin de la periode deja
        payee. Aucun remboursement au prorata n&apos;est accorde pour une
        resiliation en cours de periode.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        7. Traitement des donnees personnelles
      </h2>
      <p>
        <strong>7.1.</strong> Le traitement des donnees personnelles dans le
        cadre du Service est regi par la{" "}
        <a href="/privacy" className="underline">
          politique de confidentialite
        </a>
        , qui fait partie integrante des presentes CGU.
      </p>
      <p>
        <strong>7.2. Role des parties.</strong> Pour les donnees personnelles
        des Clients finals (prenom, telephone, historique de fidelite), le
        <strong> Commercant</strong> agit en qualite de{" "}
        <strong>responsable du traitement</strong> au sens de l&apos;article 4
        du RGPD. aswallet agit en qualite de <strong>sous-traitant</strong>{" "}
        au sens de l&apos;article 28 du RGPD, sur instruction du Commercant.
      </p>
      <p>
        <strong>7.3. Obligations du Commercant.</strong> Le Commercant
        s&apos;engage a :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          Informer ses Clients, au moment de la collecte, des finalites du
          traitement, de l&apos;identite du responsable, de leurs droits RGPD
          et de l&apos;existence du sous-traitant aswallet ;
        </li>
        <li>
          Obtenir le consentement eclaire du Client lors de
          l&apos;installation de la carte de fidelite ;
        </li>
        <li>
          Ne collecter que des donnees necessaires et proportionnees a la
          finalite de fidelisation ;
        </li>
        <li>
          Repondre aux demandes d&apos;exercice de droits de ses Clients dans
          les delais legaux, aswallet apportant son concours technique si
          besoin.
        </li>
      </ul>
      <p>
        <strong>7.4. Engagements d&apos;aswallet en qualite de
        sous-traitant.</strong> aswallet :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          Traite les donnees uniquement sur instruction documentee du
          Commercant ;
        </li>
        <li>
          Garantit la confidentialite des personnes autorisees a traiter les
          donnees ;
        </li>
        <li>
          Met en oeuvre les mesures de securite prevues a l&apos;article 32
          du RGPD (chiffrement, RLS, hashage des mots de passe) ;
        </li>
        <li>
          Notifie le Commercant en cas de violation de donnees dans un delai
          raisonnable ;
        </li>
        <li>
          Aide le Commercant a repondre aux demandes d&apos;exercice des
          droits et a realiser ses analyses d&apos;impact (AIPD) le cas
          echeant ;
        </li>
        <li>
          Ne recourt a de nouveaux sous-traitants qu&apos;apres information
          du Commercant (liste actuelle : Supabase, Vercel, Google, IONOS —
          detaillee dans la politique de confidentialite).
        </li>
      </ul>
      <p>
        <strong>7.5. Accord de traitement (DPA).</strong> Un accord de
        traitement formel (Data Processing Agreement) conforme a
        l&apos;article 28 RGPD est mis a disposition du Commercant sur simple
        demande a{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        8. Duree, resiliation et portabilite des donnees
      </h2>
      <p>
        <strong>8.1.</strong> Le contrat entre aswallet et le Commercant est
        conclu pour une duree indeterminee. Chaque partie peut y mettre fin a
        tout moment, par simple notification via l&apos;espace{" "}
        <a href="/settings" className="underline">
          Parametres
        </a>{" "}
        ou par email a contact@aswallet.fr.
      </p>
      <p>
        <strong>8.2. Portabilite.</strong> Avant toute resiliation, le
        Commercant peut exporter l&apos;ensemble de ses donnees au format
        JSON depuis{" "}
        <a href="/settings/data" className="underline">
          Parametres &rsaquo; Donnees et confidentialite
        </a>
        .
      </p>
      <p>
        <strong>8.3. Sort des donnees.</strong> A la fin du contrat, les
        donnees du Commercant et de ses Clients sont supprimees dans un delai
        de 30 jours, sauf obligation legale de conservation (facturation : 10
        ans). Le Commercant peut egalement demander leur restitution sous
        format structure.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        9. Propriete intellectuelle
      </h2>
      <p>
        Le design, le code source, les marques et logos d&apos;aswallet sont
        proteges par le droit d&apos;auteur et le droit des marques. Toute
        reproduction non autorisee est interdite. Les contenus publies par le
        Commercant (logo, nom, design de carte) restent sa propriete ; il
        concede a aswallet une licence d&apos;utilisation non exclusive pour
        la seule execution du Service.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Responsabilite</h2>
      <p>
        aswallet agit en qualite d&apos;hebergeur technique au sens de
        l&apos;article 6 de la LCEN. Le contenu des cartes de fidelite (nom,
        design, recompense, conditions de validite) est sous la responsabilite
        exclusive du Commercant emetteur. aswallet ne peut etre tenu
        responsable des engagements pris par les Commercants envers leurs
        Clients, ni des litiges commerciaux qui pourraient en decouler.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">11. Loi applicable</h2>
      <p>
        Les presentes CGU sont soumises au droit francais. Tout litige relevera
        de la competence des tribunaux de Chambery, sauf disposition
        imperative contraire du droit de la consommation.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">12. Contact</h2>
      <p>
        Pour toute question :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
      </p>
    </div>
  );
}
