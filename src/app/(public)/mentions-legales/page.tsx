import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de aswallet conformément à la loi pour la confiance dans l'économie numérique (LCEN).",
};

export default function MentionsLegalesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-sm">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        Mentions légales
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : 23 avril 2026
      </p>

      <p>
        Conformément aux dispositions des articles 6-III et 19 de la loi n&deg;
        2004-575 du 21 juin 2004 pour la Confiance dans l&apos;économie
        numérique (LCEN), les utilisateurs du site{" "}
        <a href="https://aswallet.fr" className="underline">
          aswallet.fr
        </a>{" "}
        sont informés de l&apos;identité des différents intervenants dans le
        cadre de sa réalisation et de son suivi.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. Éditeur du site</h2>
      <p>
        Le site aswallet.fr est édité par :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Shahin Gharbi</strong>, entrepreneur individuel (entreprise
          individuelle)
        </li>
        <li>Adresse : 443 Rue des Combes, 73000 Chambéry, France</li>
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
        qualité d&apos;éditeur.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Hébergeur du site</h2>
      <p>Le site est hébergé par :</p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Vercel Inc.</strong>
        </li>
        <li>440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</li>
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
        4. Hébergement des données
      </h2>
      <p>
        Les données des utilisateurs (base de données, authentification,
        stockage de fichiers) sont hébergées par :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>
          <strong>Supabase Inc.</strong> — infrastructure opérée sur Amazon Web
          Services (AWS), région eu-west-1 (Irlande, Union européenne)
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
        5. Propriété intellectuelle
      </h2>
      <p>
        L&apos;ensemble des éléments constituant le site aswallet.fr (textes,
        graphismes, logo, icônes, images, photographies, code source, structure
        générale, marques) est la propriété exclusive de Shahin Gharbi ou de
        ses partenaires. Toute reproduction, représentation, modification,
        publication, adaptation ou exploitation, totale ou partielle, par
        quelque procédé que ce soit, sans autorisation écrite préalable, est
        interdite et constitue une contrefaçon sanctionnée par les articles
        L.335-2 et suivants du Code de la propriété intellectuelle.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        6. Données personnelles
      </h2>
      <p>
        Les modalités de collecte et de traitement des données personnelles
        sont décrites en détail dans notre{" "}
        <a href="/privacy" className="underline">
          politique de confidentialité
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">7. Cookies</h2>
      <p>
        Le site aswallet.fr utilise uniquement des cookies techniques strictement
        nécessaires à la connexion et à la navigation. Aucun cookie de mesure
        d&apos;audience, de publicité ou de tracking n&apos;est déposé. Pour
        plus d&apos;informations, consultez la{" "}
        <a href="/privacy" className="underline">
          politique de confidentialité
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">
        8. Loi applicable et juridiction
      </h2>
      <p>
        Les présentes mentions légales sont régies par le droit français. En
        cas de litige relatif au site aswallet.fr ou aux services proposés, et
        à défaut de résolution amiable, compétence exclusive est attribuée aux
        tribunaux français compétents, ressort de la cour d&apos;appel de
        Chambéry.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact</h2>
      <p>
        Pour toute question relative aux présentes mentions légales :{" "}
        <a href="mailto:contact@aswallet.fr" className="underline">
          contact@aswallet.fr
        </a>
        .
      </p>
    </div>
  );
}
