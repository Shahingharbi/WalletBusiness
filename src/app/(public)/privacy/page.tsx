import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialite",
  description:
    "Politique de confidentialite de FidPass : quelles donnees nous collectons et comment nous les protegeons.",
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
        Derniere mise a jour : 18 avril 2026
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">1. Qui sommes-nous</h2>
      <p>
        FidPass est un service de cartes de fidelite digitales edite par
        Shahin Gharbi (entreprise individuelle, SIRET 903 950 210 00026),
        443 Rue des Combes, 73000 Chambery, France. Contact :{" "}
        <a href="mailto:contact@fidpass.fr" className="underline">contact@fidpass.fr</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">2. Donnees collectees</h2>
      <p>
        Lorsque vous installez une carte de fidelite chez l&apos;un de nos
        commercants partenaires, nous collectons :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>Votre prenom (obligatoire)</li>
        <li>Votre numero de telephone (optionnel)</li>
        <li>Le nombre de tampons et recompenses associes a vos cartes</li>
        <li>L&apos;historique de vos passages chez le commercant</li>
      </ul>
      <p>
        Pour les commercants utilisant FidPass, nous collectons egalement leur nom,
        email professionnel, nom du commerce, adresse et numero SIRET.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">3. Utilisation des donnees</h2>
      <p>
        Vos donnees servent uniquement a :
      </p>
      <ul className="list-disc pl-6 my-3 space-y-1">
        <li>Enregistrer vos tampons et recompenses chez les commercants</li>
        <li>Vous identifier lorsque vous presentez votre carte</li>
        <li>Permettre au commercant de vous contacter (si vous avez fourni votre telephone)</li>
        <li>Generer des statistiques anonymes pour le commercant</li>
      </ul>
      <p>
        Nous ne vendons jamais vos donnees a des tiers. Nous ne les utilisons pas
        pour de la publicite.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">4. Conservation</h2>
      <p>
        Vos donnees sont conservees tant que votre carte de fidelite est active.
        Vous pouvez demander leur suppression a tout moment en envoyant un email
        a <a href="mailto:contact@fidpass.fr" className="underline">contact@fidpass.fr</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">5. Vos droits (RGPD)</h2>
      <p>
        Conformement au RGPD, vous disposez des droits suivants : acces, rectification,
        effacement, opposition, portabilite, limitation. Pour les exercer, ecrivez
        a <a href="mailto:contact@fidpass.fr" className="underline">contact@fidpass.fr</a>.
      </p>
      <p>
        Vous pouvez aussi introduire une reclamation aupres de la CNIL :
        www.cnil.fr.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">6. Securite</h2>
      <p>
        Vos donnees sont stockees chez Supabase (hebergement Europe), avec chiffrement
        au repos et en transit (HTTPS/TLS). Nos serveurs sont heberges chez Vercel
        (region europeenne).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">7. Google Wallet</h2>
      <p>
        Si vous choisissez d&apos;ajouter votre carte a Google Wallet, Google recevra
        un identifiant unique et le contenu de votre carte (nombre de tampons, nom du
        commerce). Voir la politique de confidentialite de Google Wallet :{" "}
        <a href="https://policies.google.com/privacy" className="underline">
          policies.google.com/privacy
        </a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">8. Cookies</h2>
      <p>
        FidPass utilise uniquement des cookies techniques necessaires au
        fonctionnement du site (session d&apos;authentification). Aucun cookie de
        tracking publicitaire.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact</h2>
      <p>
        Pour toute question : <a href="mailto:contact@fidpass.fr" className="underline">contact@fidpass.fr</a>
      </p>
    </div>
  );
}
