/**
 * Helpers pour récupérer les points de vente actifs d'un commerce et les
 * formater au format `PassLocation` (Apple PassKit + Google Wallet).
 *
 * Fait sa propre query plutôt que de dépendre du caller : on garde la
 * logique de validation lat/lng + filtrage `is_active` au même endroit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PassLocation } from "./apple-wallet";

interface LocationRow {
  name: string | null;
  address: string | null;
  city: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  relevant_text: string | null;
  is_active: boolean | null;
}

/**
 * Garantit qu'on récupère un nombre fini (Supabase peut renvoyer du `numeric`
 * sous forme de string si la colonne est très précise).
 */
function toFiniteNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Charge les points de vente actifs du commerce et les convertit en
 * tableau de `PassLocation`. Retourne `[]` en cas d'erreur (silencieux : on
 * ne casse pas la génération du pass si la table est inaccessible).
 *
 * Apple/Google n'acceptent que 10 locations par pass — on tronque ici.
 */
export async function fetchPassLocations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  businessId: string
): Promise<PassLocation[]> {
  try {
    const { data, error } = await supabase
      .from("locations")
      .select("name, address, city, latitude, longitude, relevant_text, is_active")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .limit(10);
    if (error || !data) return [];
    const out: PassLocation[] = [];
    for (const row of data as LocationRow[]) {
      const lat = toFiniteNumber(row.latitude);
      const lng = toFiniteNumber(row.longitude);
      if (lat === null || lng === null) continue;
      // Texte affiché dans la notif lockscreen : custom > nom + ville > nom.
      const fallback =
        [row.name, row.city].filter(Boolean).join(" — ") ||
        row.name ||
        "Vous êtes près d'un point de vente";
      out.push({
        latitude: lat,
        longitude: lng,
        relevantText: (row.relevant_text && row.relevant_text.trim()) || fallback,
      });
    }
    return out;
  } catch (err) {
    console.warn("[locations] fetchPassLocations failed:", err);
    return [];
  }
}
