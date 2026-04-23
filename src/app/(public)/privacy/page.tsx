import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialite",
  description:
    "Politique de confidentialite de aswallet : quelles donnees nous collectons, pourquoi, combien de temps, et comment exercer vos droits RGPD.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Politique de confidentialite
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Derniere mise a jour : 23 avril 2026
      </p>

      <p>
        La presente politique de confidentialite decrit la maniere dont le
        service aswallet (ci-apres &laquo; le Service &raquo;) collecte,
        utilise et protege les donnees a caractere personnel de ses
        utilisateurs, conformement au Reglement (UE) 2016/679 (RGPD) et a la
        loi Informatique et Libertes modifiee.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        1. Responsable du traitement
      </h2>
      <p>
        Le responsable du traitement des donnees collectees via aswallet.fr
        est :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Shahin Gharbi</strong>, entrepreneur individuel, SIRET 903
          950 210 00026
        </li>
        <li>443 Rue des Combes, 73000 Chambery, France</li>
        <li>
          Contact :{" "}
          <a href="mailto:contact@aswallet.fr" className="underline">
            contact@aswallet.fr
          </a>
        </li>
      </ul>
      <p>
        <strong>Precision importante :</strong> lorsqu&apos;un client final
        installe une carte de fidelite emise par un commercant utilisant
        aswallet, le <strong>commercant</strong> est responsable du traitement
        des donnees de ses clients au sens de l&apos;article 4 du RGPD. Le
        Service aswallet agit alors comme <strong>sous-traitant</strong> au
        sens de l&apos;article 28 du RGPD.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        2. Finalites, bases legales et durees de conservation
      </h2>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left">
                Finalite
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                Donnees traitees
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                Base legale
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                Duree de conservation
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Gestion du compte commercant
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Nom, prenom, email, telephone, nom et adresse du commerce,
                SIRET, categorie
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Execution du contrat (art. 6.1.b RGPD)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Duree du compte + 3 ans pour les obligations legales
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Gestion des cartes de fidelite
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Prenom et telephone du client final, tampons collectes,
                historique de scan
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Execution du contrat entre le commercant et son client (art.
                6.1.b) — le commercant est responsable, aswallet est
                sous-traitant
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Duree de la carte active + 1 an a compter du dernier passage
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Facturation de l&apos;abonnement commercant
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Coordonnees de facturation, montants
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Obligation legale (art. 6.1.c) — code de commerce
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                10 ans (art. L.123-22 Code de commerce)
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Securite et prevention de la fraude
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Adresse IP, user-agent, logs d&apos;authentification
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Interet legitime (art. 6.1.f) — proteger le service
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                12 mois
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Reponse aux demandes par email
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Email, contenu du message
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Interet legitime (art. 6.1.f)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                3 ans apres le dernier echange
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Ajout a Google Wallet / Apple Wallet (optionnel)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Contenu public de la carte, identifiant unique
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Consentement explicite de l&apos;utilisateur final (art. 6.1.a)
              </td>
              <td className="border border-gray-300 px-3 py-2 align-top">
                Tant que la carte est installee dans le wallet
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
        suivants, tous encadres par un accord de traitement (DPA) et, pour les
        transferts hors UE, par les Clauses Contractuelles Types (SCC) de la
        Commission europeenne :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-2">
        <li>
          <strong>Supabase Inc.</strong> (Etats-Unis, donnees hebergees sur
          AWS eu-west-1, Irlande) — authentification, base de donnees,
          stockage de fichiers. DPA + SCC.
        </li>
        <li>
          <strong>Vercel Inc.</strong> (Etats-Unis) — hebergement du site et
          execution des fonctions serveur. DPA + SCC.
        </li>
        <li>
          <strong>Google LLC</strong> (Etats-Unis) — uniquement si
          l&apos;utilisateur final choisit d&apos;ajouter sa carte a Google
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
          <strong>IONOS SE</strong> (Allemagne, Union europeenne) — service
          email (reception / envoi depuis contact@aswallet.fr).
        </li>
      </ul>
      <p>
        aswallet ne vend, ne loue et ne cede jamais de donnees a des tiers a
        des fins commerciales ou publicitaires.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        4. Transferts de donnees hors Union europeenne
      </h2>
      <p>
        Certains sous-traitants (Vercel, Google, et la societe mere Supabase
        Inc.) sont etablis aux Etats-Unis. Ces transferts sont encadres par :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          Les <strong>Clauses Contractuelles Types</strong> (SCC) adoptees par
          la Commission europeenne en 2021
        </li>
        <li>
          Le <strong>Data Privacy Framework</strong> UE-Etats-Unis, lorsque
          le sous-traitant y est certifie
        </li>
        <li>
          Des mesures techniques supplementaires (chiffrement au repos et en
          transit) garantissant un niveau de protection equivalent a celui de
          l&apos;Union europeenne
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        5. Vos droits sur vos donnees
      </h2>
      <p>
        Conformement aux articles 15 a 22 du RGPD, vous disposez des droits
        suivants :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Droit d&apos;acces</strong> : obtenir une copie des donnees
          vous concernant
        </li>
        <li>
          <strong>Droit de rectification</strong> : corriger des donnees
          inexactes ou incompletes
        </li>
        <li>
          <strong>Droit a l&apos;effacement</strong> (droit a l&apos;oubli) :
          supprimer vos donnees, sauf obligation legale contraire
        </li>
        <li>
          <strong>Droit d&apos;opposition</strong> : vous opposer au
          traitement de vos donnees pour un motif legitime
        </li>
        <li>
          <strong>Droit a la portabilite</strong> : recuperer vos donnees
          dans un format structure et lisible par machine
        </li>
        <li>
          <strong>Droit a la limitation</strong> : restreindre le traitement
          de vos donnees dans certains cas
        </li>
        <li>
          <strong>Droit de retrait du consentement</strong> a tout moment,
          lorsque le traitement est base sur le consentement
        </li>
        <li>
          <strong>Droit de definir des directives post-mortem</strong> sur le
          sort de vos donnees apres votre deces
        </li>
      </ul>
      <p>
        <strong>Pour les commercants</strong> : vous pouvez exercer vos droits
        d&apos;acces, de portabilite et d&apos;effacement directement depuis
        votre espace{" "}
        <a href="/settings/data" className="underline">
          Parametres &rsaquo; Donnees et confidentialite
        </a>{" "}
        (export JSON et suppression du compte).
      </p>
      <p>
        <strong>Pour tout autre droit ou pour les clients finals</strong> :
        envoyez un email a{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>{" "}
        en precisant votre demande. Nous repondrons dans un delai maximum
        d&apos;un mois (article 12.3 RGPD).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Reclamation aupres de la CNIL
      </h2>
      <p>
        Si vous estimez, apres nous avoir contactes, que vos droits ne sont
        pas respectes, vous pouvez adresser une reclamation a la Commission
        Nationale de l&apos;Informatique et des Libertes :
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
        7. Securite des donnees
      </h2>
      <p>
        aswallet met en oeuvre les mesures techniques et organisationnelles
        appropriees pour proteger vos donnees :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>Chiffrement en transit (HTTPS/TLS 1.2+)</li>
        <li>Chiffrement au repos (AES-256 cote base de donnees)</li>
        <li>Mots de passe hashes (bcrypt) — jamais stockes en clair</li>
        <li>
          Isolation des donnees entre commercants via Row Level Security
          (Supabase RLS)
        </li>
        <li>
          Acces aux donnees restreint au strict necessaire et journalise
        </li>
      </ul>
      <p>
        En cas de violation de donnees, une notification sera adressee a la
        CNIL dans les 72 heures (art. 33 RGPD) et aux personnes concernees si
        le risque est eleve (art. 34 RGPD).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">8. Cookies</h2>
      <p>
        aswallet utilise <strong>uniquement</strong> des cookies techniques
        strictement necessaires au fonctionnement du Service :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <code>sb-access-token</code>, <code>sb-refresh-token</code> :
          cookies de session d&apos;authentification (Supabase)
        </li>
      </ul>
      <p>
        Conformement aux recommandations de la CNIL, ces cookies sont
        dispenses du recueil du consentement car ils sont strictement
        necessaires a la fourniture du service expressement demande par
        l&apos;utilisateur.{" "}
        <strong>
          aswallet n&apos;utilise aucun cookie de tracking, de mesure
          d&apos;audience ou de publicite
        </strong>{" "}
        (pas de Google Analytics, pas de Facebook Pixel, aucun tiers
        publicitaire).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        9. Modifications de la presente politique
      </h2>
      <p>
        aswallet se reserve le droit de modifier la presente politique de
        confidentialite pour refleter les evolutions legales ou du Service.
        Toute modification substantielle sera notifiee par email aux
        utilisateurs inscrits au moins 30 jours avant sa prise d&apos;effet.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact</h2>
      <p>
        Pour toute question relative a la presente politique ou a vos donnees
        personnelles :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        .
      </p>
    </div>
  );
}
