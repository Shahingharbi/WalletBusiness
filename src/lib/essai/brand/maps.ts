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
 *
 * `findPlace({ name, city?, website?, location? })` : retrouve la fiche d'un
 * commerce SANS lien Maps (Instagram, nom saisi, capture, site) par la
 * recherche texte Places, avec un choix prudent (nom, domaine du site, ville,
 * distance) — sans IA.
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

// ─── Recherche d'une fiche par nom (findPlace) ────────────────────────────

/** France métropolitaine (+ Corse) : écarte les homonymes à l'étranger. */
const FRANCE_RECT = {
  rectangle: { low: { latitude: 41.3, longitude: -5.3 }, high: { latitude: 51.2, longitude: 9.7 } },
};

/** Suffixes publics à deux niveaux (le nom de domaine « utile » est avant). */
const SECOND_LEVEL_TLDS = new Set(["co.uk", "org.uk", "com.fr", "asso.fr", "gouv.fr", "com.au", "co.nz", "com.br", "co.za", "com.tr", "com.es", "co.jp"]);

/**
 * Hébergeurs / plateformes partagés par des milliers de commerces : deux sites
 * sur le même domaine ne prouvent rien (on compare alors l'hôte complet).
 */
const SHARED_HOSTS = new Set([
  "wixsite.com", "business.site", "eatbu.com", "myshopify.com", "webnode.fr", "webnode.com", "jimdofree.com",
  "jimdosite.com", "wordpress.com", "squarespace.com", "blogspot.com", "over-blog.com", "e-monsite.com",
  "site123.me", "godaddysites.com", "webflow.io", "carrd.co", "ueniweb.com", "simplesite.com", "zenchef.com",
  "sumupstore.com", "google.com", "facebook.com", "instagram.com", "linktr.ee", "ubereats.com", "deliveroo.fr",
  "just-eat.fr", "planity.com", "treatwell.fr", "pagesjaunes.fr", "tripadvisor.fr", "thefork.fr", "github.io",
]);

/** Mots trop génériques pour chercher une fiche sur ce seul nom. */
const GENERIC_QUERY_WORDS = new Set([
  "restaurant", "boulangerie", "patisserie", "pizzeria", "pizza", "kebab", "burger", "tacos", "sushi", "cafe",
  "bar", "coiffeur", "coiffure", "barbier", "barber", "fleuriste", "epicerie", "boucherie", "pressing",
  "glacier", "onglerie", "institut", "beaute", "snack", "traiteur", "mon commerce", "commerce", "shop", "store",
]);

export interface FindPlaceQuery {
  /** Nom du commerce (saisi, IA, pseudo nettoyé…). */
  name: string;
  city?: string | null;
  /** Site connu (bio, site saisi) : un domaine identique désigne la bonne fiche. */
  website?: string | null;
  location?: { lat: number; lng: number } | null;
}

export interface FoundPlace {
  placeId: string;
  /** Nom de la fiche tel quel (« Chicken Spot Alfortville »). */
  name: string;
  /** Nom sans le suffixe d'établissement (« Chicken Spot »). */
  brandName: string;
  address: string | null;
  location: { lat: number; lng: number } | null;
  website: string | null;
  /**
   * Sites des fiches de la même enseigne (domaines distincts, le plus fréquent
   * d'abord) : si le premier redirige ailleurs, l'appelant essaie le suivant.
   */
  websites: string[];
  /** Formulaire d'avis Google : writereview?placeid=… */
  reviewUrl: string;
  mapsUrl: string | null;
  /** Photos Places (ressources « places/…/photos/… »), meilleure d'abord. */
  photoNames: string[];
  types: string[];
  /**
   * « sure » : même nom (hors suffixe d'établissement) ou même site ;
   * « likely » : nom proche (contient le nom cherché) — bon pour un lien
   * d'avis à vérifier, pas pour renommer la carte.
   */
  confidence: "sure" | "likely";
}

function compact(s: string): string {
  return normalizeName(s).replace(/ /g, "");
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** « restaurants.mcdonalds.fr » → « mcdonalds.fr » ; « x.co.uk » → « x.co.uk ». */
function registrableDomain(host: string): string {
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return (SECOND_LEVEL_TLDS.has(lastTwo) ? labels.slice(-3) : labels.slice(-2)).join(".");
}

/**
 * Deux sites désignent-ils le même commerce ? 2 = même domaine,
 * 1 = même nom de domaine sous une autre extension (chickenspot.fr / .com),
 * 0 = non. Les hébergeurs partagés exigent l'hôte complet.
 */
function domainMatch(a: string | null | undefined, b: string | null | undefined): 0 | 1 | 2 {
  const ha = hostOf(a);
  const hb = hostOf(b);
  if (!ha || !hb) return 0;
  const ra = registrableDomain(ha);
  const rb = registrableDomain(hb);
  if (SHARED_HOSTS.has(ra) || SHARED_HOSTS.has(rb)) return ha === hb ? 2 : 0;
  if (ra === rb) return 2;
  const la = ra.split(".")[0];
  const lb = rb.split(".")[0];
  return la.length >= 4 && la === lb ? 1 : 0;
}

/** Ville d'une adresse française (« …, 94140 Alfortville, France » → « alfortville »). */
function cityOfAddress(address: string | null | undefined): string {
  if (!address) return "";
  const m = /\b\d{4,5}\s+([^,]+)/.exec(address);
  if (m) return normalizeName(m[1]);
  const parts = address.split(",").map((p) => p.trim()).filter((p) => p && !/^france$/i.test(p));
  return parts.length ? normalizeName(parts[parts.length - 1]) : "";
}

/**
 * Nom d'enseigne sans le suffixe d'établissement : « Chicken Spot - Grand
 * Oran », « Chicken Spot (Bastille) », « Chicken spot Ivry-Sur-Seine » (ville
 * de l'adresse) → « Chicken Spot ». Seule la VILLE est retirée (jamais une
 * partie de la rue : « Boulangerie de la Gare » reste entier).
 */
export function stripBranchSuffix(display: string, address: string | null | undefined): string {
  let s = display.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const dash = /^(.{3,}?)\s+[-–—|·•]\s+.+$/.exec(s);
  if (dash) s = dash[1].trim();
  const city = cityOfAddress(address);
  if (city) {
    const words = s.split(" ");
    for (let k = Math.min(4, words.length - 1); k >= 1; k--) {
      if (normalizeName(words.slice(-k).join(" ")) === city) {
        // La ville fait partie du nom (« Café de Paris », « Le Marseille »).
        const rest = words.slice(0, -k);
        if (/^(?:de|du|des|d|la|le|les|l|a|au|aux|en|sur|the|of|chez)$/.test(normalizeName(rest[rest.length - 1] ?? ""))) break;
        s = rest.join(" ");
        break;
      }
    }
  }
  return s.replace(/[\s,;:–—-]+$/, "").trim() || display.trim();
}

interface ScoredPlace {
  place: PlacesPlace;
  score: number;
  confidence: "sure" | "likely" | null;
  brandName: string;
}

function scorePlace(p: PlacesPlace, index: number, q: FindPlaceQuery): ScoredPlace {
  const display = p.displayName?.text?.trim() ?? "";
  const wanted = compact(q.name);
  const full = compact(display);
  // Fiche au nom exact de la recherche : rien à retirer (« Le Marseille »).
  const brandName = full === wanted ? display : stripBranchSuffix(display, p.formattedAddress);
  const brand = compact(brandName);
  const wantedTokens = normalizeName(q.name).split(" ").filter((t) => t.length >= 2);
  const displayTokens = new Set(normalizeName(display).split(" "));

  // Nom : identique (hors suffixe) > contient le nom cherché > mots communs.
  let nameScore = 0;
  if (wanted && (brand === wanted || full === wanted)) nameScore = 30;
  else if (wanted.length >= 4 && (brand.startsWith(wanted) || full.startsWith(wanted))) nameScore = 20;
  else if (wanted.length >= 5 && full.includes(wanted)) nameScore = 16;
  else if (brand.length >= 5 && wanted.includes(brand)) nameScore = 14;
  else if (wantedTokens.length >= 2) {
    const common = wantedTokens.filter((t) => displayTokens.has(t)).length;
    if (common / wantedTokens.length >= 0.67) nameScore = 8;
  }

  // Nom saisi « Boulangerie Paul Lyon » ↔ fiche « PAUL » à Lyon : sans le
  // mot de métier ni les mots de l'adresse (la ville), le cœur du nom doit
  // être exactement l'enseigne. Une ville tapée dans le nom vaut ville connue.
  const addressTokens = new Set(normalizeName(p.formattedAddress ?? "").split(" "));
  const cityInName = wantedTokens.some(
    (t) => t.length >= 3 && !GENERIC_QUERY_WORDS.has(t) && addressTokens.has(t) && !displayTokens.has(t)
  );
  const core = wantedTokens.filter((t) => !GENERIC_QUERY_WORDS.has(t) && !addressTokens.has(t)).join("");
  if (nameScore < 26 && core.length >= 3 && core !== wanted && (core === brand || core === full)) {
    nameScore = 26;
  }

  const domain = q.website ? domainMatch(q.website, p.websiteUri) : 0;
  const city = q.city ? normalizeName(q.city) : "";
  const cityOk = (!!city && normalizeName(p.formattedAddress ?? "").includes(city)) || cityInName;

  let distanceScore = 0;
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (q.location && typeof lat === "number" && typeof lng === "number") {
    const d = distanceMeters(q.location, { lat, lng });
    distanceScore = d < 300 ? 15 : d < 2_000 ? 8 : d > 50_000 ? -15 : 0;
  }

  const score = nameScore + (domain === 2 ? 25 : domain === 1 ? 15 : 0) + (cityOk ? 10 : 0) + distanceScore - index;

  let confidence: ScoredPlace["confidence"] = null;
  if (nameScore >= 30 || (domain > 0 && nameScore >= 8) || (nameScore >= 14 && (cityOk || distanceScore >= 8))) {
    confidence = "sure";
  } else if (nameScore >= 14 || domain === 2) {
    confidence = "likely";
  }
  // Loin des coordonnées connues : jamais « sûr ».
  if (distanceScore < 0 && confidence === "sure") confidence = "likely";
  return { place: p, score, confidence, brandName };
}

async function searchText(
  key: string,
  textQuery: string,
  extra: Record<string, unknown>,
): Promise<PlacesPlace[]> {
  const result = (await placesRequest(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": PLACES_FIELDS.map((f) => `places.${f}`).join(","),
      },
      body: JSON.stringify({ textQuery, languageCode: "fr", regionCode: "fr", pageSize: 6, ...extra }),
    },
    key,
  )) as { places?: PlacesPlace[] } | null;
  return result?.places ?? [];
}

/**
 * Trouve la fiche Google d'un commerce à partir de son nom (+ ville, site,
 * coordonnées si connus) via Places API (New) `searchText`. Sans ville ni
 * coordonnées, la recherche est d'abord limitée à la France métropolitaine
 * (« Chicken Spot » ramènerait sinon un homonyme à Oran), puis élargie.
 *
 * Le meilleur résultat est choisi par similarité de nom, domaine du site,
 * ville et distance. null : pas de clé, nom trop générique, aucun résultat
 * assez proche, ou API en erreur (jamais d'exception).
 */
export async function findPlace(query: FindPlaceQuery): Promise<FoundPlace | null> {
  const key = placesKey();
  const name = (query.name ?? "").replace(/\s+/g, " ").trim();
  if (!key || name.length < 2 || name.length > 80) return null;
  const norm = normalizeName(name);
  if (!norm || compact(name).length < 3 || GENERIC_QUERY_WORDS.has(norm)) return null;

  const city = query.city?.replace(/\s+/g, " ").trim() || null;
  const attempts: { text: string; extra: Record<string, unknown>; world?: boolean }[] = [];
  if (query.location) {
    attempts.push({
      text: city ? `${name} ${city}` : name,
      extra: {
        locationBias: {
          circle: { center: { latitude: query.location.lat, longitude: query.location.lng }, radius: 3_000 },
        },
      },
    });
  } else if (city) {
    attempts.push({ text: `${name} ${city}`, extra: {} });
  } else {
    attempts.push({ text: name, extra: { locationRestriction: FRANCE_RECT } });
  }
  // Repli : nom seul, sans restriction (DOM-TOM, Belgique, ville mal lue…).
  // Après une recherche limitée à la France, un résultat étranger ne remplace
  // jamais un candidat français et n'est jamais « sûr » sans le même site.
  attempts.push({ text: name, extra: {}, world: !query.location && !city });

  const rank = (s: ScoredPlace) => (s.confidence === "sure" ? 1_000 : 0) + s.score;
  try {
    let best: ScoredPlace | null = null;
    let matches: ScoredPlace[] = [];
    for (const attempt of attempts) {
      if (attempt.world && best) break;
      const places = await searchText(key, attempt.text, attempt.extra);
      matches = [];
      for (const [i, p] of places.entries()) {
        if (!p.id) continue;
        const scored = scorePlace(p, i, { ...query, name, city });
        if (!scored.confidence) continue;
        if (attempt.world && scored.confidence === "sure" && domainMatch(query.website, p.websiteUri) === 0) {
          scored.confidence = "likely";
        }
        matches.push(scored);
        if (!best || rank(scored) > rank(best)) best = scored;
      }
      if (best?.confidence === "sure") break;
    }
    if (!best?.place.id) return null;

    // Homonymes : sans ville, coordonnées ni site pour trancher, une autre
    // fiche « sûre » ailleurs avec le site d'une AUTRE enseigne (La Fabrique
    // Paris ≠ La Fabrique Bordeaux) → on ne sait pas laquelle : « probable ».
    // Une chaîne (mêmes sites chickenspot.fr / .com) reste « sûre ».
    if (best.confidence === "sure" && !city && !query.location && domainMatch(query.website, best.place.websiteUri) === 0) {
      const brandOf = (u: string | undefined) => {
        const h = hostOf(httpUrlOrNull(u));
        return h ? registrableDomain(h).split(".")[0] : null;
      };
      const bestCity = cityOfAddress(best.place.formattedAddress);
      const bestBrand = brandOf(best.place.websiteUri);
      const homonym = matches.some(
        (m) =>
          m !== best &&
          m.confidence === "sure" &&
          cityOfAddress(m.place.formattedAddress) !== bestCity &&
          // Fiche sans site : aucune preuve (agence d'une chaîne sans site).
          bestBrand !== null &&
          brandOf(m.place.websiteUri) !== null &&
          brandOf(m.place.websiteUri) !== bestBrand
      );
      if (homonym) best.confidence = "likely";
    }

    // Sites des fiches de même confiance, regroupés par domaine (le plus
    // fréquent d'abord : « chickenspot.com » ×3 avant « chickenspot.fr » ×1).
    const byDomain = new Map<string, { url: string; count: number; rank: number }>();
    for (const m of [best, ...matches.filter((m) => m.confidence === best.confidence)]) {
      const site = httpUrlOrNull(m.place.websiteUri);
      const host = hostOf(site);
      if (!site || !host) continue;
      const domain = registrableDomain(host);
      if (SHARED_HOSTS.has(domain)) continue;
      const entry = byDomain.get(domain);
      if (entry) entry.count++;
      else byDomain.set(domain, { url: site, count: m === best ? 1.5 : 1, rank: rank(m) });
    }
    const websites = [...byDomain.values()].sort((a, b) => b.count - a.count || b.rank - a.rank).map((e) => e.url);

    const p = best.place;
    const placeId = p.id as string;
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    const display = clampName(p.displayName?.text?.trim() || best.brandName);
    return {
      placeId,
      name: display,
      brandName: clampName(best.brandName),
      address: p.formattedAddress?.trim() || null,
      location: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null,
      website: httpUrlOrNull(p.websiteUri),
      websites,
      reviewUrl: reviewUrlFor(placeId),
      mapsUrl: httpUrlOrNull(p.googleMapsUri),
      photoNames: rankPlacesPhotoNames(p.photos, best.brandName),
      types: [p.primaryType, ...(p.types ?? [])].filter(
        (t, i, all): t is string => typeof t === "string" && t.length > 0 && all.indexOf(t) === i,
      ),
      confidence: best.confidence ?? "likely",
    };
  } catch (err) {
    console.warn(`[essai/maps] recherche de fiche impossible (${err instanceof Error ? err.name : "erreur"})`);
    return null;
  }
}

// ─── API publique ─────────────────────────────────────────────────────────

/** Types Places d'un lieu qui n'est pas un établissement (adresse, ville…). */
const NOT_A_BUSINESS_TYPES = new Set([
  "street_address", "premise", "subpremise", "route", "intersection", "locality", "sublocality",
  "neighborhood", "postal_code", "political", "administrative_area_level_1", "administrative_area_level_2",
  "administrative_area_level_3", "country", "plus_code", "geocode",
]);

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

  // Simple recherche (« /maps/search/boulangerie ») : ce n'est pas UNE fiche,
  // la deviner donnerait le lien d'avis d'un concurrent.
  const searchOnly = /\/maps\/search\//i.test(longUrl.pathname) && !parsed.cid && !parsed.placeId;

  const key = placesKey();
  const place = key && !searchOnly ? await lookupPlace(parsed, key) : null;

  if (place) {
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const types = [place.primaryType, ...(place.types ?? [])].filter(
      (t, i, all): t is string => typeof t === "string" && t.length > 0 && all.indexOf(t) === i,
    );
    const placeName = place.displayName?.text?.trim();
    // Adresse, rue, ville, code postal… : pas un établissement → pas d'avis.
    const notBusiness = types.some((t) => NOT_A_BUSINESS_TYPES.has(t));
    return {
      name: placeName ? clampName(placeName) : parsed.name ? clampName(parsed.name) : null,
      location: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : parsed.location,
      address: place.formattedAddress?.trim() || parsed.address,
      types,
      website: httpUrlOrNull(place.websiteUri),
      reviewUrl: place.id && !notBusiness ? reviewUrlFor(place.id) : null,
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
    // Une page d'adresse a un CID (ftid) mais pas de nom (looksLikeAddress) :
    // seul un lien « ?cid= » classique désigne à coup sûr un établissement.
    reviewUrl: parsed.placeId
      ? reviewUrlFor(parsed.placeId)
      : (parsed.name && !searchOnly) || (parsed.cid && longUrl.searchParams.has("cid"))
        ? mapsUrl
        : null,
    mapsUrl,
    placesApiUsed: false,
    placeId: parsed.placeId,
  };
}
