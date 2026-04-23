import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description:
    "Conditions générales d'utilisation du service aswallet.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Conditions générales d&apos;utilisation
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : 23 avril 2026
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. Éditeur</h2>
      <p>
        aswallet est un service édité par Shahin Gharbi (entreprise
        individuelle, SIRET 903 950 210 00026), 443 Rue des Combes, 73000
        Chambéry, France. Contact :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        . Les mentions légales complètes sont disponibles sur la page{" "}
        <a href="/mentions-legales" className="underline">
          Mentions légales
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">2. Objet</h2>
      <p>
        aswallet permet aux commerçants (ci-après &laquo; le Commerçant &raquo;)
        de créer et gérer des cartes de fidélité digitales pour leurs clients
        finals (ci-après &laquo; le Client &raquo;). Les Clients utilisent ces
        cartes via un navigateur web, Google Wallet ou Apple Wallet.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Accès au service</h2>
      <p>
        Le service est accessible 24h/24, 7j/7, sauf interruption pour
        maintenance. aswallet ne garantit pas une disponibilité ininterrompue
        et s&apos;engage à déployer les meilleurs efforts pour maintenir le
        service. Aucune indemnité ne pourra être réclamée en cas
        d&apos;indisponibilité temporaire.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">4. Compte commerçant</h2>
      <p>
        Le Commerçant s&apos;engage à fournir des informations exactes lors de
        l&apos;inscription, à maintenir la confidentialité de ses identifiants,
        et à notifier immédiatement aswallet de toute utilisation non
        autorisée de son compte.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        5. Utilisation par le client final
      </h2>
      <p>
        L&apos;installation d&apos;une carte de fidélité est gratuite pour le
        Client. Aucun paiement ne lui est demandé. Les récompenses associées à
        la carte sont attribuées et honorées directement par le Commerçant
        émetteur, sous sa seule responsabilité.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Tarification commerçant
      </h2>
      <p>
        L&apos;abonnement commerçant est facturé mensuellement ou annuellement
        selon la formule choisie. Les tarifs sont indiqués sur la page Tarifs
        du site. Toute résiliation prend effet à la fin de la période déjà
        payée. Aucun remboursement au prorata n&apos;est accordé pour une
        résiliation en cours de période.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        7. Traitement des données personnelles
      </h2>
      <p>
        <strong>7.1.</strong> Le traitement des données personnelles dans le
        cadre du Service est régi par la{" "}
        <a href="/privacy" className="underline">
          politique de confidentialité
        </a>
        , qui fait partie intégrante des présentes CGU.
      </p>
      <p>
        <strong>7.2. Rôle des parties.</strong> Pour les données personnelles
        des Clients finals (prénom, téléphone, historique de fidélité), le
        <strong> Commerçant</strong> agit en qualité de{" "}
        <strong>responsable du traitement</strong> au sens de l&apos;article 4
        du RGPD. aswallet agit en qualité de <strong>sous-traitant</strong>{" "}
        au sens de l&apos;article 28 du RGPD, sur instruction du Commerçant.
      </p>
      <p>
        <strong>7.3. Obligations du Commerçant.</strong> Le Commerçant
        s&apos;engage à :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          Informer ses Clients, au moment de la collecte, des finalités du
          traitement, de l&apos;identité du responsable, de leurs droits RGPD
          et de l&apos;existence du sous-traitant aswallet ;
        </li>
        <li>
          Obtenir le consentement éclairé du Client lors de
          l&apos;installation de la carte de fidélité ;
        </li>
        <li>
          Ne collecter que des données nécessaires et proportionnées à la
          finalité de fidélisation ;
        </li>
        <li>
          Répondre aux demandes d&apos;exercice de droits de ses Clients dans
          les délais légaux, aswallet apportant son concours technique si
          besoin.
        </li>
      </ul>
      <p>
        <strong>7.4. Engagements d&apos;aswallet en qualité de
        sous-traitant.</strong> aswallet :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          Traite les données uniquement sur instruction documentée du
          Commerçant ;
        </li>
        <li>
          Garantit la confidentialité des personnes autorisées à traiter les
          données ;
        </li>
        <li>
          Met en œuvre les mesures de sécurité prévues à l&apos;article 32
          du RGPD (chiffrement, RLS, hashage des mots de passe) ;
        </li>
        <li>
          Notifie le Commerçant en cas de violation de données dans un délai
          raisonnable ;
        </li>
        <li>
          Aide le Commerçant à répondre aux demandes d&apos;exercice des
          droits et à réaliser ses analyses d&apos;impact (AIPD) le cas
          échéant ;
        </li>
        <li>
          Ne recourt à de nouveaux sous-traitants qu&apos;après information
          du Commerçant (liste actuelle : Supabase, Vercel, Google, IONOS —
          détaillée dans la politique de confidentialité).
        </li>
      </ul>
      <p>
        <strong>7.5. Accord de traitement (DPA).</strong> Un accord de
        traitement formel (Data Processing Agreement) conforme à
        l&apos;article 28 RGPD est mis à disposition du Commerçant sur simple
        demande à{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        8. Durée, résiliation et portabilité des données
      </h2>
      <p>
        <strong>8.1.</strong> Le contrat entre aswallet et le Commerçant est
        conclu pour une durée indéterminée. Chaque partie peut y mettre fin à
        tout moment, par simple notification via l&apos;espace{" "}
        <a href="/settings" className="underline">
          Paramètres
        </a>{" "}
        ou par email à contact@aswallet.fr.
      </p>
      <p>
        <strong>8.2. Portabilité.</strong> Avant toute résiliation, le
        Commerçant peut exporter l&apos;ensemble de ses données au format
        JSON depuis{" "}
        <a href="/settings/data" className="underline">
          Paramètres &rsaquo; Données et confidentialité
        </a>
        .
      </p>
      <p>
        <strong>8.3. Sort des données.</strong> À la fin du contrat, les
        données du Commerçant et de ses Clients sont supprimées dans un délai
        de 30 jours, sauf obligation légale de conservation (facturation : 10
        ans). Le Commerçant peut également demander leur restitution sous
        format structuré.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        9. Propriété intellectuelle
      </h2>
      <p>
        Le design, le code source, les marques et logos d&apos;aswallet sont
        protégés par le droit d&apos;auteur et le droit des marques. Toute
        reproduction non autorisée est interdite. Les contenus publiés par le
        Commerçant (logo, nom, design de carte) restent sa propriété ; il
        concède à aswallet une licence d&apos;utilisation non exclusive pour
        la seule exécution du Service.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Responsabilité</h2>
      <p>
        aswallet agit en qualité d&apos;hébergeur technique au sens de
        l&apos;article 6 de la LCEN. Le contenu des cartes de fidélité (nom,
        design, récompense, conditions de validité) est sous la responsabilité
        exclusive du Commerçant émetteur. aswallet ne peut être tenu
        responsable des engagements pris par les Commerçants envers leurs
        Clients, ni des litiges commerciaux qui pourraient en découler.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">11. Loi applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. Tout litige relèvera
        de la compétence des tribunaux de Chambéry, sauf disposition
        impérative contraire du droit de la consommation.
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
