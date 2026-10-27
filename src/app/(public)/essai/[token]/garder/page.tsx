import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadEssai } from "@/lib/essai/load";
import { GarderClient } from "./garder-client";

/**
 * /essai/[token]/garder — « Je garde ma carte ».
 *
 * - Visiteur non connecté → inscription avec la carte en attente
 *   (/register?essai=<token>), qui revient ici une fois le compte créé.
 * - Connecté → le composant client lance la copie de la carte dans son
 *   commerce (POST /api/essai/<token>/claim) puis ouvre la carte dans le
 *   dashboard.
 */

export const metadata: Metadata = {
  title: "Je garde ma carte",
  robots: { index: false, follow: false },
};

export default async function GarderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loaded = await loadEssai(token);
  if (!loaded) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/register?essai=${encodeURIComponent(token)}`);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr").replace(/\/$/, "");
  const { card } = loaded;

  return (
    <GarderClient
      token={token}
      name={card.name}
      logoUrl={card.design.logo_url}
      background={card.design.background_color}
      accent={card.design.accent_color}
      essaiPageUrl={`${appUrl}/essai/${token}`}
    />
  );
}
