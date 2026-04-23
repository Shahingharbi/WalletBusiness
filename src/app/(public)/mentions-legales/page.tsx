import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions legales",
  description:
    "Mentions legales de aswallet conformement a la loi pour la confiance dans l'economie numerique (LCEN).",
};

export default function MentionsLegalesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Mentions legales
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Derniere mise a jour : 23 avril 2026
      </p>

      <p>
        Conformement aux dispositions des articles 6-III et 19 de la loi n&deg;
        2004-575 du 21 juin 2004 pour la Confiance dans l&apos;economie
        numerique (LCEN), les utilisateurs du site{" "}
        <a href="https://aswallet.fr" className="underline">
          aswallet.fr
        </a>{" "}
        sont informes de l&apos;identite des differents intervenants dans le
        cadre de sa realisation et de son suivi.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. Editeur du site</h2>
      <p>
        Le site aswallet.fr est edite par :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Shahin Gharbi</strong>, entrepreneur individuel (entreprise
          individuelle)
        </li>
        <li>Adresse : 443 Rue des Combes, 73000 Chambery, France</li>
        <li>SIRET : 903 950 210 00026</li>
        <li>
          TVA intracommunautaire : non applicable, article 293 B du CGI
          (franchise en base de TVA, entrepreneur individuel)
        </li>
        <li>
          Contact :{" "}
          <a href="mailto:contact@aswallet.fr" className="underline">
            contact@aswallet.fr
          </a>
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        2. Directeur de la publication
      </h2>
      <p>
        Le directeur de la publication est Monsieur Shahin Gharbi, en sa
        qualite d&apos;editeur.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Hebergeur du site</h2>
      <p>Le site est heberge par :</p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Vercel Inc.</strong>
        </li>
        <li>440 N Barranca Ave #4133, Covina, CA 91723, Etats-Unis</li>
        <li>
          Site web :{" "}
          <a
            href="https://vercel.com"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://vercel.com
          </a>
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        4. Hebergement des donnees
      </h2>
      <p>
        Les donnees des utilisateurs (base de donnees, authentification,
        stockage de fichiers) sont hebergees par :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Supabase Inc.</strong> — infrastructure operee sur Amazon Web
          Services (AWS), region eu-west-1 (Irlande, Union europeenne)
        </li>
        <li>
          Site web :{" "}
          <a
            href="https://supabase.com"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://supabase.com
          </a>
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        5. Propriete intellectuelle
      </h2>
      <p>
        L&apos;ensemble des elements constituant le site aswallet.fr (textes,
        graphismes, logo, icones, images, photographies, code source, structure
        generale, marques) est la propriete exclusive de Shahin Gharbi ou de
        ses partenaires. Toute reproduction, representation, modification,
        publication, adaptation ou exploitation, totale ou partielle, par
        quelque procede que ce soit, sans autorisation ecrite prealable, est
        interdite et constitue une contrefacon sanctionnee par les articles
        L.335-2 et suivants du Code de la propriete intellectuelle.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Donnees personnelles
      </h2>
      <p>
        Les modalites de collecte et de traitement des donnees personnelles
        sont decrites en detail dans notre{" "}
        <a href="/privacy" className="underline">
          politique de confidentialite
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">7. Cookies</h2>
      <p>
        Le site aswallet.fr utilise uniquement des cookies techniques strictement
        necessaires a la connexion et a la navigation. Aucun cookie de mesure
        d&apos;audience, de publicite ou de tracking n&apos;est depose. Pour
        plus d&apos;informations, consultez la{" "}
        <a href="/privacy" className="underline">
          politique de confidentialite
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        8. Loi applicable et juridiction
      </h2>
      <p>
        Les presentes mentions legales sont regies par le droit francais. En
        cas de litige relatif au site aswallet.fr ou aux services proposes, et
        a defaut de resolution amiable, competence exclusive est attribuee aux
        tribunaux francais competents, ressort de la cour d&apos;appel de
        Chambery.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact</h2>
      <p>
        Pour toute question relative aux presentes mentions legales :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        .
      </p>
    </div>
  );
}
