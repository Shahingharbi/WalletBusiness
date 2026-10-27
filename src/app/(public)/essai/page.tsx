import type { Metadata, Viewport } from "next";
import { EssaiForm } from "./essai-form";
import { MAX_LINK_LENGTH } from "./link-kind";

export const metadata: Metadata = {
  title: "Votre carte de fidélité en 30 secondes",
  description:
    "Collez le lien de votre commerce ou prenez une photo de votre enseigne : votre carte de fidélité à vos couleurs, prête à ajouter dans Apple Wallet et Google Wallet. Sans inscription.",
  alternates: { canonical: "/essai" },
};

// Barre du navigateur mobile assortie au fond beige de la page (le layout
// public impose sinon un vert hérité des cartes clients).
export const viewport: Viewport = {
  themeColor: "#f9f7f0",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Générateur de carte d'essai.
 *  - `?url=…`      : lien collé depuis l'accueil → création lancée d'office ;
 *  - `?mode=photo` : arrivée par « prenez une photo » → import photo ouvert.
 *
 * Les paramètres sont lus ici (serveur) plutôt qu'avec useSearchParams pour
 * que le formulaire soit rendu complet dès le HTML initial, sans Suspense.
 */
export default async function EssaiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialUrl = (firstParam(params.url) ?? "")
    .trim()
    .slice(0, MAX_LINK_LENGTH);
  const initialPhotoMode = firstParam(params.mode) === "photo";

  return <EssaiForm initialUrl={initialUrl} initialPhotoMode={initialPhotoMode} />;
}
