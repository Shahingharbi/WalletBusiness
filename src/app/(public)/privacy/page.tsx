import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de aswallet : quelles données nous collectons, pourquoi, combien de temps, et comment exercer vos droits RGPD.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Politique de confidentialité
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : 23 avril 2026
      </p>

      <p>
        La présente politique de confidentialité décrit la manière dont le
        service aswallet (ci-après &laquo; le Service &raquo;) collecte,
        utilise et protège les données à caractère personnel de ses
        utilisateurs, conformément au Règlement (UE) 2016/679 (RGPD) et à la
        loi Informatique et Libertés modifiée.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        1. Responsable du traitement
      </h2>
      <p>
        Le responsable du traitement des données collectées via aswallet.fr
        est :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Shahin Gharbi</strong>, entrepreneur individuel, SIRET 903
          950 210 00026
        </li>
        <li>443 Rue des Combes, 73000 Chambéry, France</li>
        <li>
          Contact :{" "}
          <a href="mailto:contact@aswallet.fr" className="underline">
            contact@aswallet.fr
          </a>
        </li>
      </ul>
      <p>
        <strong>Précision importante :</strong> lorsqu&apos;un client final
        installe une carte de fidélité émise par un commerçant utilisant
        aswallet, le <strong>commerçant</strong> est responsable du traitement
        des données de ses clients au sens de l&apos;article 4 du RGPD. Le
        Service aswallet agit alors comme <strong>sous-traitant</strong> au
        sens de l&apos;article 28 du RGPD.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        2. Finalités, bases légales et durées de conservation
      </h2>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left">
                Finalité
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                Données traitées
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                Base légale
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                Durée de conservation
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Gestion du compte commerçant
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Nom, prénom, email, téléphone, nom et adresse du commerce,
                SIRET, catégorie
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Exécution du contrat (art. 6.1.b RGPD)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Durée du compte + 3 ans pour les obligations légales
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Gestion des cartes de fidélité
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Prénom et téléphone du client final, tampons collectés,
                historique de scan
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Exécution du contrat entre le commerçant et son client (art.
                6.1.b) — le commerçant est responsable, aswallet est
                sous-traitant
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Durée de la carte active + 1 an à compter du dernier passage
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Facturation de l&apos;abonnement commerçant
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Coordonnées de facturation, montants
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Obligation légale (art. 6.1.c) — code de commerce
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                10 ans (art. L.123-22 Code de commerce)
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Sécurité et prévention de la fraude
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Adresse IP, user-agent, logs d&apos;authentification
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Intérêt légitime (art. 6.1.f) — protéger le service
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                12 mois
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Réponse aux demandes par email
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Email, contenu du message
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Intérêt légitime (art. 6.1.f)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                3 ans après le dernier échange
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Ajout à Google Wallet / Apple Wallet (optionnel)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Contenu public de la carte, identifiant unique
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Consentement explicite de l&apos;utilisateur final (art. 6.1.a)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Tant que la carte est installée dans le wallet
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        3. Destinataires et sous-traitants
      </h2>
      <p>
        Pour fournir le Service, aswallet fait appel aux sous-traitants
        suivants, tous encadrés par un accord de traitement (DPA) et, pour les
        transferts hors UE, par les Clauses Contractuelles Types (SCC) de la
        Commission européenne :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-2">
        <li>
          <strong>Supabase Inc.</strong> (États-Unis, données hébergées sur
          AWS eu-west-1, Irlande) — authentification, base de données,
          stockage de fichiers. DPA + SCC.
        </li>
        <li>
          <strong>Vercel Inc.</strong> (États-Unis) — hébergement du site et
          exécution des fonctions serveur. DPA + SCC.
        </li>
        <li>
          <strong>Google LLC</strong> (États-Unis) — uniquement si
          l&apos;utilisateur final choisit d&apos;ajouter sa carte à Google
          Wallet. DPA + SCC. Politique Google :{" "}
          <a
            href="https://policies.google.com/privacy"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            policies.google.com/privacy
          </a>
          .
        </li>
        <li>
          <strong>IONOS SE</strong> (Allemagne, Union européenne) — service
          email (réception / envoi depuis contact@aswallet.fr).
        </li>
      </ul>
      <p>
        aswallet ne vend, ne loue et ne cède jamais de données à des tiers à
        des fins commerciales ou publicitaires.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        4. Transferts de données hors Union européenne
      </h2>
      <p>
        Certains sous-traitants (Vercel, Google, et la société mère Supabase
        Inc.) sont établis aux États-Unis. Ces transferts sont encadrés par :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          Les <strong>Clauses Contractuelles Types</strong> (SCC) adoptées par
          la Commission européenne en 2021
        </li>
        <li>
          Le <strong>Data Privacy Framework</strong> UE-États-Unis, lorsque
          le sous-traitant y est certifié
        </li>
        <li>
          Des mesures techniques supplémentaires (chiffrement au repos et en
          transit) garantissant un niveau de protection équivalent à celui de
          l&apos;Union européenne
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        5. Vos droits sur vos données
      </h2>
      <p>
        Conformément aux articles 15 à 22 du RGPD, vous disposez des droits
        suivants :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Droit d&apos;accès</strong> : obtenir une copie des données
          vous concernant
        </li>
        <li>
          <strong>Droit de rectification</strong> : corriger des données
          inexactes ou incomplètes
        </li>
        <li>
          <strong>Droit à l&apos;effacement</strong> (droit à l&apos;oubli) :
          supprimer vos données, sauf obligation légale contraire
        </li>
        <li>
          <strong>Droit d&apos;opposition</strong> : vous opposer au
          traitement de vos données pour un motif légitime
        </li>
        <li>
          <strong>Droit à la portabilité</strong> : récupérer vos données
          dans un format structuré et lisible par machine
        </li>
        <li>
          <strong>Droit à la limitation</strong> : restreindre le traitement
          de vos données dans certains cas
        </li>
        <li>
          <strong>Droit de retrait du consentement</strong> à tout moment,
          lorsque le traitement est basé sur le consentement
        </li>
        <li>
          <strong>Droit de définir des directives post-mortem</strong> sur le
          sort de vos données après votre décès
        </li>
      </ul>
      <p>
        <strong>Pour les commerçants</strong> : vous pouvez exercer vos droits
        d&apos;accès, de portabilité et d&apos;effacement directement depuis
        votre espace{" "}
        <a href="/settings/data" className="underline">
          Paramètres &rsaquo; Données et confidentialité
        </a>{" "}
        (export JSON et suppression du compte).
      </p>
      <p>
        <strong>Pour tout autre droit ou pour les clients finals</strong> :
        envoyez un email à{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>{" "}
        en précisant votre demande. Nous répondrons dans un délai maximum
        d&apos;un mois (article 12.3 RGPD).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Réclamation auprès de la CNIL
      </h2>
      <p>
        Si vous estimez, après nous avoir contactés, que vos droits ne sont
        pas respectés, vous pouvez adresser une réclamation à la Commission
        Nationale de l&apos;Informatique et des Libertés :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07</li>
        <li>
          Site :{" "}
          <a
            href="https://www.cnil.fr"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.cnil.fr
          </a>
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        7. Sécurité des données
      </h2>
      <p>
        aswallet met en œuvre les mesures techniques et organisationnelles
        appropriées pour protéger vos données :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>Chiffrement en transit (HTTPS/TLS 1.2+)</li>
        <li>Chiffrement au repos (AES-256 côté base de données)</li>
        <li>Mots de passe hashés (bcrypt) — jamais stockés en clair</li>
        <li>
          Isolation des données entre commerçants via Row Level Security
          (Supabase RLS)
        </li>
        <li>
          Accès aux données restreint au strict nécessaire et journalisé
        </li>
      </ul>
      <p>
        En cas de violation de données, une notification sera adressée à la
        CNIL dans les 72 heures (art. 33 RGPD) et aux personnes concernées si
        le risque est élevé (art. 34 RGPD).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">8. Cookies</h2>
      <p>
        aswallet utilise <strong>uniquement</strong> des cookies techniques
        strictement nécessaires au fonctionnement du Service :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <code>sb-access-token</code>, <code>sb-refresh-token</code> :
          cookies de session d&apos;authentification (Supabase)
        </li>
      </ul>
      <p>
        Conformément aux recommandations de la CNIL, ces cookies sont
        dispensés du recueil du consentement car ils sont strictement
        nécessaires à la fourniture du service expressément demandé par
        l&apos;utilisateur.{" "}
        <strong>
          aswallet n&apos;utilise aucun cookie de tracking, de mesure
          d&apos;audience ou de publicité
        </strong>{" "}
        (pas de Google Analytics, pas de Facebook Pixel, aucun tiers
        publicitaire).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        9. Modifications de la présente politique
      </h2>
      <p>
        aswallet se réserve le droit de modifier la présente politique de
        confidentialité pour refléter les évolutions légales ou du Service.
        Toute modification substantielle sera notifiée par email aux
        utilisateurs inscrits au moins 30 jours avant sa prise d&apos;effet.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact</h2>
      <p>
        Pour toute question relative à la présente politique ou à vos données
        personnelles :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        .
      </p>
    </div>
  );
}
