/**
 * Liens Google Maps → signaux de marque (nom, coordonnées, adresse, types,
 * site web, lien d'avis).
 *
 * SERVER-ONLY (safeFetch / process.env).
 *
 * Deux niveaux :
 *  1. TOUJOURS : on lit ce que l'URL contient déjà (nom de la fiche dans
 *     /maps/place/<Nom>/, coordonnées !3d…!4d… ou @lat,lng, identifiant
 *     0x…:0x… → CID, place_id ChIJ…). Les liens courts (maps.app.goo.gl,
 *     goo.gl/maps, g.co/kgs, share.google) sont résolus en lisant les en-têtes
 *     `Location` un par un, SANS suivre aveuglément : on s'arrête dès qu'on
 *     atteint une URL google.* (qu'on ne télécharge jamais : on la parse) et
 *     on refuse une redirection vers un domaine non Google.
 *  2. SI `GOOGLE_PLACES_API_KEY` est défini : Places API (New) pour le nom
 *     officiel, l'adresse, les types, le site web et un VRAI lien d'avis
 *     (`writereview?placeid=…`). Sans clé, on se contente du niveau 1.
 */

import { clampName } from "@/lib/essai/brand/category";
import { rankPlacesPhotoNames } from "@/lib/essai/brand/photo";
import { normalizeUserUrl, safeFetch, SafeFetchError } from "@/lib/essai/brand/safe-fetch";
import type { MapsSignals } from "@/lib/essai/types";

/** google.com, google.fr, maps.google.co.uk, www.google.com.br… */
const GOOGLE_HOST_RE = /^(?:www\.|maps\.)?google\.(?:[a-z]{2,3}|com?\.[a-z]{2})$/;
const CONSENT_HOST_RE = /^consent\.google\.(?:[a-z]{2,3}|com?\.[a-z]{2})$/;

const PLACES_TIMEOUT_MS = 6_000;
const SHORT_LINK_TIMEOUT_MS = 5_000;
const MAX_SHORT_LINK_HOPS = 4;

const PLACES_FIELDS = [
  "id",
  "displayName",
  "primaryType",
  "types",
  "formattedAddress",
  "location",
  "websiteUri",
  "googleMapsUri",
  "photos",
];

const ERR_INVALID = "Ce lien Google Maps n'est pas valide. Copiez-le depuis le bouton « Partager » de la fiche.";
const ERR_SHORT_LINK = "Impossible d'ouvrir ce lien Google Maps. Copiez-le à nouveau depuis le bouton « Partager ».";
const ERR_DEAD_SHORT_LINK = "Ce lien Google Maps ne fonctionne plus. Copiez-le à nouveau depuis le bouton « Partager » de la fiche.";

// ─── Reconnaissance des URLs ──────────────────────────────────────────────

function parseLoose(input: string): URL | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`);
  } catch {
    return null;
  }
}

/** Lien court Google qu'il faut résoudre (redirection) avant de le parser. */
function isShortLink(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return u.pathname.length > 1;
  if (host === "goo.gl" || host === "www.goo.gl") return /^\/maps(?:\/|$)/i.test(u.pathname);
  if (host === "g.co") return /^\/kgs\/.+/i.test(u.pathname);
  if (host === "share.google") return u.pathname.length > 1;
  return false;
}

function isGoogleHost(host: string): boolean {
  return GOOGLE_HOST_RE.test(host.toLowerCase());
}

/** Recherche Google pointant sur une fiche d'établissement (best-effort). */
function isGoogleBusinessSearch(u: URL): boolean {
  return (
    isGoogleHost(u.hostname) &&
    u.pathname === "/search" &&
    (u.searchParams.has("ludocid") || u.searchParams.has("kgmid"))
  );
}

/**
 * `true` pour un lien Google Maps : liens courts (maps.app.goo.gl,
 * goo.gl/maps, g.co/kgs, share.google), `maps.google.*`, `google.*\/maps…`
 * et recherches Google sur une fiche (`ludocid` / `kgmid`).
 */
export function isGoogleMapsUrl(url: string): boolean {
  const u = parseLoose(url);
  if (!u || (u.protocol !== "https:" && u.protocol !== "http:")) return false;
  if (isShortLink(u)) return true;
  const host = u.hostname.toLowerCase();
  if (!isGoogleHost(host)) return false;
  if (host.startsWith("maps.")) return true;
  if (/^\/maps(?:[/@]|$)/i.test(u.pathname)) return true;
  return isGoogleBusinessSearch(u);
}

// ─── Résolution des liens courts ──────────────────────────────────────────

/**
 * Redirections Google « enveloppes » : page de consentement cookies
 * (`consent.google.*?continue=<cible>`) et `google.*\/url?q=<cible>`. On lit la
 * cible au lieu de passer par la page.
 */
function unwrapGoogleRedirect(u: URL): URL {
  const host = u.hostname.toLowerCase();
  const target =
    (CONSENT_HOST_RE.test(host) && u.searchParams.get("continue")) ||
    (isGoogleHost(host) && u.pathname === "/url" && (u.searchParams.get("q") || u.searchParams.get("url"))) ||
    null;
  if (!target) return u;
  try {
    return new URL(target);
  } catch {
    return u;
  }
}

/** Dernier recours : une URL Google Maps écrite dans le HTML (meta refresh, JS). */
function findMapsUrlInHtml(html: string): URL | null {
  const unescaped = html
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/&amp;/g, "&");
  const re = /https?:\/\/(?:www\.|maps\.)?google\.[a-z.]{2,6}\/maps[^\s"'<>\\]*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(unescaped))) {
    const u = parseLoose(m[0]);
    if (u && isGoogleMapsUrl(u.toString()) && !isShortLink(u)) return u;
  }
  return null;
}

/**
 * Suit un lien court saut par saut (max 4) en lisant `Location` sans suivre
 * automatiquement : chaque saut passe par safeFetch (validation SSRF), et on
 * s'arrête dès que la cible est une URL google.* (jamais téléchargée).
 */
async function resolveShortLink(start: URL): Promise<URL> {
  let current = start;
  for (let hop = 0; hop < MAX_SHORT_LINK_HOPS; hop++) {
    let res: Awaited<ReturnType<typeof safeFetch>>;
    try {
      res = await safeFetch(current.toString(), {
        followRedirects: false,
        timeoutMs: SHORT_LINK_TIMEOUT_MS,
        maxBytes: 512 * 1024,
        truncate: true,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      });
    } catch (err) {
      // Lien court expiré ou mal copié (404) : message adapté plutôt que « erreur HTTP ».
      if (err instanceof SafeFetchError && err.code === "http_error") {
        throw new SafeFetchError("http_error", ERR_DEAD_SHORT_LINK, err.status);
      }
      throw err;
    }

    if (res.status >= 300 && res.status < 400) {
      let next: URL;
      try {
        next = unwrapGoogleRedirect(new URL(res.headers.get("location") ?? "", current));
      } catch {
        throw new SafeFetchError("invalid_url", ERR_SHORT_LINK);
      }
      if (isShortLink(next)) {
        current = next;
        continue;
      }
      if (isGoogleHost(next.hostname)) return next;
      // Un lien « Google Maps » qui renvoie ailleurs que chez Google : on ne suit pas.
      throw new SafeFetchError("invalid_url", ERR_SHORT_LINK);
    }

    const found = findMapsUrlInHtml(res.body.toString("utf8"));
    if (found) return found;
    throw new SafeFetchError("http_error", ERR_SHORT_LINK, res.status);
  }
  throw new SafeFetchError("too_many_redirects", ERR_SHORT_LINK);
}

// ─── Parsing d'une URL longue ─────────────────────────────────────────────

interface ParsedMapsUrl {
  name: string | null;
  query: string | null;
  address: string | null;
  location: { lat: number; lng: number } | null;
  cid: string | null;
  placeId: string | null;
  /** Lien de fiche nettoyé (sans paramètres de suivi) quand on n'a ni CID ni place_id. */
  cleanUrl: string;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s.replace(/\+/g, " ");
  }
}

function toLocation(latRaw: string | undefined, lngRaw: string | undefined): { lat: number; lng: number } | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/** « 12 Rue de la Paix, 75002 Paris » ressemble à une adresse, pas à un nom de commerce. */
function looksLikeAddress(s: string): boolean {
  return (
    /^\d+\s*(?:bis|ter)?\s*,?\s*(?:rue|avenue|av\.?|bd|boulevard|place|pl\.?|chemin|route|rte|all[ée]e|impasse|quai|cours|faubourg|square|passage|esplanade|street|st\.?|road|rd\.?)\b/i.test(s) ||
    /,\s*\d{5}\s+\S/.test(s)
  );
}

const COORDS_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Hex « 0x8ddca9ee380ef7e0 » → CID décimal (BigInt : dépasse 2^53). */
function hexToCid(hex: string): string | null {
  try {
    const n = BigInt(hex);
    return n > BigInt(0) ? n.toString() : null;
  } catch {
    return null;
  }
}

/** Paramètres de suivi retirés du lien canonique. */
const TRACKING_PARAMS = ["entry", "g_ep", "g_st", "skid", "shorturl", "coh", "ucbcb", "authuser", "hl", "gl"];

function parseMapsUrl(u: URL): ParsedMapsUrl {
  const href = u.toString();
  const decodedHref = safeDecode(href);
  const params = u.searchParams;

  let name: string | null = null;
  let query: string | null = null;
  let address: string | null = null;

  // /maps/place/<Nom>/…
  const place = /\/maps\/place\/([^/@?#]+)/i.exec(u.pathname);
  if (place) name = safeDecode(place[1]).trim() || null;
  // /maps/search/<requête>/…
  const search = /\/maps\/search\/([^/@?#]+)/i.exec(u.pathname);
  if (search) query = safeDecode(search[1]).trim() || null;
  // /maps/dir/<départ>/<arrivée>/… : l'arrivée est la fiche visée.
  if (!name && !query && /\/maps\/dir\//i.test(u.pathname)) {
    const parts = u.pathname.split("/").filter((p) => p && !p.startsWith("@") && !p.startsWith("data="));
    const last = parts[parts.length - 1];
    if (last && last.toLowerCase() !== "dir") query = safeDecode(last).trim() || null;
  }

  // place_id explicite (ChIJ…) : paramètres ou bloc data (!19sChIJ…).
  let placeId: string | null =
    params.get("query_place_id") || params.get("placeid") || params.get("place_id") || null;
  const q = params.get("q") || params.get("query") || params.get("destination") || null;
  if (q) {
    const pid = /^place_id:(\S+)$/i.exec(q.trim());
    if (pid) placeId = placeId ?? pid[1];
    else if (!COORDS_RE.test(q) && !query) query = q.trim();
  }
  if (!placeId) {
    const data = /!19s(ChIJ[\w-]+)/.exec(decodedHref);
    if (data) placeId = data[1];
  }
  if (placeId && !/^[\w-]{10,}$/.test(placeId)) placeId = null;

  // Coordonnées : épingle de la fiche (!3d…!4d…) > centre de la vue (@lat,lng) > ll/center/q.
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decodedHref);
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(u.pathname);
  const llParam = params.get("ll") || params.get("center") || (q && COORDS_RE.test(q) ? q : null);
  const llMatch = llParam ? COORDS_RE.exec(llParam) : null;
  const location =
    (pin && toLocation(pin[1], pin[2])) ||
    (view && toLocation(view[1], view[2])) ||
    (llMatch && toLocation(llMatch[1], llMatch[2])) ||
    null;

  // CID : ?cid= / ?ludocid=, sinon 2e partie de l'identifiant 0x…:0x… (data ou ftid).
  let cid: string | null = null;
  const cidParam = params.get("cid") || params.get("ludocid");
  if (cidParam && /^\d{1,20}$/.test(cidParam)) cid = cidParam;
  if (!cid) {
    const ftid = /(0x[0-9a-f]{1,16}):(0x[0-9a-f]{1,16})/i.exec(decodedHref);
    if (ftid) cid = hexToCid(ftid[2]);
  }

  // Nom = une adresse (épingle posée sur une adresse) : ce n'est pas un nom de commerce.
  if (name && looksLikeAddress(name)) {
    address = name;
    name = null;
  }
  // Requête « Nom, adresse » (anciens liens de partage ?q=…) : la partie
  // avant la 1re virgule est le nom, la suite l'adresse.
  if (!name && query) {
    const [head, ...rest] = query.split(",");
    const headTrim = head.trim();
    const restTrim = rest.join(",").trim();
    if (headTrim && !/^\d/.test(headTrim) && !looksLikeAddress(headTrim)) {
      name = headTrim;
      if (restTrim && looksLikeAddress(restTrim)) address = address ?? restTrim;
    } else if (looksLikeAddress(query)) {
      address = address ?? query;
    }
  }

  const clean = new URL(href);
  clean.hash = "";
  for (const p of TRACKING_PARAMS) clean.searchParams.delete(p);
  [...clean.searchParams.keys()].filter((k) => k.startsWith("utm_")).forEach((k) => clean.searchParams.delete(k));

  return { name, query, address, location, cid, placeId, cleanUrl: clean.toString() };
}

// ─── Places API (New) ─────────────────────────────────────────────────────

interface PlacesPlace {
  id?: string;
  displayName?: { text?: string };
  primaryType?: string;
  types?: string[];
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  websiteUri?: string;
  googleMapsUri?: string;
  photos?: unknown[];
}

function placesKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? key : null;
}

async function placesRequest(url: string, init: RequestInit, key: string): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      "X-Goog-Api-Key": key,
    },
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Statut + code d'erreur Google seulement (jamais la clé ni la requête complète).
    let reason = "";
    try {
      const body = (await res.json()) as { error?: { status?: string } };
      reason = body.error?.status ?? "";
    } catch {
      // Corps illisible : le statut HTTP suffit.
    }
    console.warn(`[essai/maps] Places API HTTP ${res.status} ${reason}`.trim());
    return null;
  }
  return res.json();
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Parmi les résultats d'une recherche texte, préfère celui dont le nom
 * correspond et qui est le plus proche des coordonnées de l'URL.
 */
function pickBestPlace(
  places: PlacesPlace[],
  name: string | null,
  location: { lat: number; lng: number } | null,
): PlacesPlace | null {
  if (places.length === 0) return null;
  const wanted = name ? normalizeName(name) : "";
  let best: PlacesPlace | null = null;
  let bestScore = -Infinity;
  for (let index = 0; index < places.length; index++) {
    const p = places[index];
    let score = -index; // l'ordre de Google reste le départage
    const display = normalizeName(p.displayName?.text ?? "");
    if (wanted && display) {
      if (display === wanted) score += 20;
      else if (display.includes(wanted) || wanted.includes(display)) score += 10;
    }
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (location && typeof lat === "number" && typeof lng === "number") {
      const d = distanceMeters(location, { lat, lng });
      score += d < 150 ? 10 : d < 500 ? 5 : d > 5_000 ? -10 : 0;
    }
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

async function lookupPlace(parsed: ParsedMapsUrl, key: string): Promise<PlacesPlace | null> {
  try {
    if (parsed.placeId) {
      const details = (await placesRequest(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(parsed.placeId)}?languageCode=fr`,
        { method: "GET", headers: { "X-Goog-FieldMask": PLACES_FIELDS.join(",") } },
        key,
      )) as PlacesPlace | null;
      if (details?.id) return details;
    }

    const textQuery = parsed.name ?? parsed.query ?? parsed.address;
    if (!textQuery) return null;
    const body: Record<string, unknown> = { textQuery, languageCode: "fr", pageSize: 5 };
    if (parsed.location) {
      body.locationBias = {
        circle: {
          center: { latitude: parsed.location.lat, longitude: parsed.location.lng },
          radius: 300,
        },
      };
    }
    const result = (await placesRequest(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-FieldMask": PLACES_FIELDS.map((f) => `places.${f}`).join(","),
        },
        body: JSON.stringify(body),
      },
      key,
    )) as { places?: PlacesPlace[] } | null;
    return pickBestPlace(result?.places ?? [], parsed.name ?? parsed.query, parsed.location);
  } catch (err) {
    const reason = err instanceof Error ? err.name : "erreur";
    console.warn(`[essai/maps] Places API indisponible (${reason})`);
    return null;
  }
}

// ─── API publique ─────────────────────────────────────────────────────────

function reviewUrlFor(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

function httpUrlOrNull(s: string | undefined | null): string | null {
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Analyse un lien Google Maps.
 *
 * Lève `SafeFetchError` seulement si le lien est invalide ou si un lien
 * court ne peut pas être résolu (rien d'exploitable). Une Places API absente
 * ou en erreur n'est PAS une erreur : on renvoie ce que l'URL contient.
 */
export async function extractMapsSignals(url: string): Promise<MapsSignals> {
  const normalized = normalizeUserUrl(url);
  const start = normalized ? new URL(normalized) : null;
  if (!start || !isGoogleMapsUrl(start.toString())) {
    throw new SafeFetchError("invalid_url", ERR_INVALID);
  }

  const longUrl = isShortLink(start) ? await resolveShortLink(start) : unwrapGoogleRedirect(start);
  const parsed = parseMapsUrl(longUrl);

  const mapsUrl = parsed.cid
    ? `https://maps.google.com/?cid=${parsed.cid}`
    : parsed.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(parsed.placeId)}`
      : parsed.cleanUrl;

  const key = placesKey();
  const place = key ? await lookupPlace(parsed, key) : null;

  if (place) {
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const types = [place.primaryType, ...(place.types ?? [])].filter(
      (t, i, all): t is string => typeof t === "string" && t.length > 0 && all.indexOf(t) === i,
    );
    const placeName = place.displayName?.text?.trim();
    return {
      name: placeName ? clampName(placeName) : parsed.name ? clampName(parsed.name) : null,
      location: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : parsed.location,
      address: place.formattedAddress?.trim() || parsed.address,
      types,
      website: httpUrlOrNull(place.websiteUri),
      reviewUrl: place.id ? reviewUrlFor(place.id) : mapsUrl,
      mapsUrl: httpUrlOrNull(place.googleMapsUri) ?? mapsUrl,
      placesApiUsed: true,
      placeId: place.id ?? parsed.placeId,
      photoNames: rankPlacesPhotoNames(place.photos, placeName ?? parsed.name),
    };
  }

  return {
    name: parsed.name ? clampName(parsed.name) : null,
    location: parsed.location,
    address: parsed.address,
    types: [],
    website: null,
    // Sans Places API : lien d'avis direct si l'URL contenait le place_id,
    // sinon la fiche elle-même (le bouton « Donner un avis » y est visible) —
    // à condition que le lien désigne bien un établissement (pas une liste
    // enregistrée, une simple vue de carte ou une adresse).
    reviewUrl: parsed.placeId
      ? reviewUrlFor(parsed.placeId)
      : parsed.cid || parsed.name
        ? mapsUrl
        : null,
    mapsUrl,
    placesApiUsed: false,
    placeId: parsed.placeId,
  };
}
