/**
 * Géocodage server-to-server via Nominatim (OpenStreetMap).
 *
 * Différent de `/api/locations/geocode` qui sert le frontend authentifié :
 * ce helper est appelé en interne (PATCH business, signup, onboarding) pour
 * créer automatiquement un point de vente géo-push à partir de l'adresse
 * commerce — sans demander au merchant d'aller manuellement sur /locations.
 *
 * Volontairement permissif côté pays (Nominatim renvoie le meilleur match
 * monde sans `countrycodes`) : on supporte FR, DZ et tout autre commerce.
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

interface NominatimRow {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Construit une chaîne d'adresse normalisée pour Nominatim. Tous les champs
 * sont optionnels mais au moins l'un parmi `address`/`city` doit être non-vide
 * pour qu'on tente l'appel.
 */
function buildQuery(parts: {
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string {
  return [parts.address, parts.postal_code, parts.city, parts.country]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Géocode une adresse via Nominatim. Retourne `null` si :
 *  - l'adresse construite fait moins de 4 caractères
 *  - Nominatim renvoie 0 résultat
 *  - le service est indisponible
 *  - timeout 5s
 *
 * Le caller doit gérer le `null` proprement (ne pas créer de location plutôt
 * que créer une location mal géocodée).
 */
export async function geocodeAddress(parts: {
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): Promise<GeocodeResult | null> {
  const q = buildQuery(parts);
  if (q.length < 4) return null;

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    "accept-language": "fr",
  });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "aswallet/1.0 (https://aswallet.fr)",
        },
      },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimRow[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const r = data[0];
    const lat = Number.parseFloat(r.lat);
    const lon = Number.parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon, display_name: r.display_name };
  } catch (err) {
    console.warn("[geocode] failed:", err);
    return null;
  }
}
