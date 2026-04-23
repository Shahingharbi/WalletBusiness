import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataPrivacyActions } from "./data-privacy-actions";

export const metadata: Metadata = {
  title: "Donnees et confidentialite",
};

export default function SettingsDataPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Donnees et confidentialite
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Exercez vos droits RGPD : exportez ou supprimez l&apos;ensemble de
          vos donnees.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exporter mes donnees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Telechargez un fichier JSON contenant l&apos;integralite de vos
            donnees : profil, commerce, cartes, clients, transactions,
            invitations.
          </p>
          <p className="text-xs text-gray-500">
            Droit a la portabilite — article 20 du RGPD.
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
                Mentions legales
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-black underline">
                Politique de confidentialite
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-black underline">
                Conditions generales d&apos;utilisation
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
