import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataPrivacyActions } from "./data-privacy-actions";

export const metadata: Metadata = {
  title: "Données et confidentialité",
};

export default function SettingsDataPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Données et confidentialité
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Exercez vos droits RGPD : exportez ou supprimez l&apos;ensemble de
          vos données.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exporter mes données</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Téléchargez un fichier JSON contenant l&apos;intégralité de vos
            données : profil, commerce, cartes, clients, transactions,
            invitations.
          </p>
          <p className="text-xs text-gray-500">
            Droit à la portabilité — article 20 du RGPD.
          </p>
          <DataPrivacyActions />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liens utiles</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/mentions-legales" className="text-black underline">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-black underline">
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-black underline">
                Conditions générales d&apos;utilisation
              </Link>
            </li>
            <li>
              <a
                href="mailto:contact@aswallet.fr"
                className="text-black underline"
              >
                contact@aswallet.fr
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
