/**
 * Photo de la bande de tampons — OBLIGATOIRE sur toute carte d'essai.
 *
 * Sortie unique (`BrandPhoto`) : JPEG sRGB paysage 1600×1067 (3:2), qualité
 * 82. Le 3:2 laisse de la marge aux rendus : la bande wallet (≈ 3:1) et
 * l'affiche recadrent dedans sans perdre le sujet.
 *
 * Sources, par priorité (choisie par index.ts) :
 *   1. photo déposée (`photoFromUpload`) ;
 *   2. zone « photo » d'une capture Instagram / Facebook (`photoFromBox`, si
 *      la zone fait au moins 500 px de large) ;
 *   3. photos du site (`pickWebsitePhoto` : og:image paysage, grandes images
 *      du haut de page, image JSON-LD) ;
 *   4. photos Google Places (`placesPhoto`, si GOOGLE_PLACES_API_KEY) ;
 *   5. photo du métier (`stockPhoto`, jamais en échec : au pire un fond
 *      dégradé aux couleurs de la marque).
 *
 * Server-only (sharp, safeFetch, process.env).
 */

import sharp from "sharp";
import type { BrandColors, BrandPhoto, EssaiCategory, UploadedImage } from "../types";
import { normalizeForMatch } from "./category";
import { safeFetch } from "./safe-fetch";
import { stockPhotoUrls } from "./stock-photos";

export const PHOTO_WIDTH = 1600;
export const PHOTO_HEIGHT = 1067;
const QUALITY = 82;
/** Côté max décodé avant recadrage (au-delà, aucun gain visible). */
const DECODE_MAX_SIDE = 2400;
/** Zone photo d'une capture d'écran : largeur minimale (px réels). */
const MIN_BOX_WIDTH = 500;
/** Photo de site : largeur minimale et format paysage. */
const MIN_WEB_WIDTH = 600;
const MIN_WEB_HEIGHT = 300;
const MIN_WEB_ASPECT = 1.2;
const MAX_WEB_CANDIDATES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 6_000;
/** Une « photo » : ≥ 40 bacs de couleur pour couvrir 85 % des pixels (un aplat / logo en a peu). */
const PHOTO_MIN_COMPLEXITY = 40;
const PLACES_TIMEOUT_MS = 6_000;

export type PhotoBox = { x: number; y: number; w: number; h: number };

/** Image illisible (format inconnu, fichier corrompu). Message affichable. */
export class PhotoReadError extends Error {
  constructor() {
    super("Cette image n'a pas pu être lue. Essayez avec une autre photo (JPG ou PNG).");
    this.name = "PhotoReadError";
  }
}

// ─── Normalisation ────────────────────────────────────────────────────────

interface Decoded {
  data: Buffer;
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
  /** Rapport px d'origine / px décodés (≥ 1). */
  scale: number;
}

/** Décode (orientation EXIF appliquée), réduit à 2 400 px de côté max. */
async function decode(input: Buffer): Promise<Decoded | null> {
  try {
    const base = sharp(input, { failOn: "none", animated: false, limitInputPixels: 80_000_000 });
    const meta = await base.metadata();
    const swap = (meta.orientation ?? 1) >= 5;
    const srcW = (swap ? meta.height : meta.width) ?? 0;
    const { data, info } = await base
      .rotate()
      .resize(DECODE_MAX_SIDE, DECODE_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height) return null;
    return {
      data,
      width: info.width,
      height: info.height,
      channels: info.channels as Decoded["channels"],
      scale: srcW > 0 ? Math.max(1, srcW / info.width) : 1,
    };
  } catch {
    return null;
  }
}

function rawInput(d: { width: number; height: number; channels: number }) {
  return { raw: { width: d.width, height: d.height, channels: d.channels as 1 | 2 | 3 | 4 } };
}

/**
 * Recadrage 3:2 propre + JPEG. Image plus large que 3:2 : centrée. Plus
 * haute (portrait, carré) : centrée horizontalement, et verticalement un
 * peu au-dessus du milieu (40 %) — enseigne et vitrine sont rarement au ras
 * du trottoir. Pas de « recadrage intelligent » de sharp : il se laisse
 * attirer par un vélo ou un panneau au premier plan.
 */
async function encode(d: Decoded, source: BrandPhoto["source"]): Promise<BrandPhoto> {
  const target = PHOTO_WIDTH / PHOTO_HEIGHT;
  let width = d.width;
  let height = d.height;
  let left = 0;
  let top = 0;
  if (d.width / d.height > target) {
    width = Math.max(1, Math.round(d.height * target));
    left = Math.round((d.width - width) / 2);
  } else {
    height = Math.max(1, Math.round(d.width / target));
    top = Math.round((d.height - height) * 0.4);
  }
  const jpeg = await sharp(d.data, rawInput(d))
    .extract({ left, top, width, height })
    .flatten({ background: "#ffffff" })
    .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("srgb")
    .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
  return { jpeg, width: PHOTO_WIDTH, height: PHOTO_HEIGHT, source };
}

/** Extrait une zone relative (0..1) d'une image décodée. */
async function extractBox(d: Decoded, box: PhotoBox): Promise<Decoded | null> {
  const vals = [box.x, box.y, box.w, box.h];
  if (!vals.every((v) => Number.isFinite(v))) return null;
  const x0 = Math.max(0, Math.min(1, box.x));
  const y0 = Math.max(0, Math.min(1, box.y));
  const x1 = Math.max(0, Math.min(1, box.x + box.w));
  const y1 = Math.max(0, Math.min(1, box.y + box.h));
  const left = Math.round(x0 * d.width);
  const top = Math.round(y0 * d.height);
  const width = Math.min(d.width - left, Math.round((x1 - x0) * d.width));
  const height = Math.min(d.height - top, Math.round((y1 - y0) * d.height));
  if (width < 16 || height < 16) return null;
  const { data, info } = await sharp(d.data, rawInput(d))
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels as Decoded["channels"], scale: d.scale };
}

/** Normalise n'importe quelle image en `BrandPhoto` ; null si illisible. */
export async function normalizePhoto(input: Buffer, source: BrandPhoto["source"]): Promise<BrandPhoto | null> {
  const d = await decode(input);
  if (!d) return null;
  try {
    return await encode(d, source);
  } catch (err) {
    console.warn("[essai/photo] normalisation impossible:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Photo déposée par le commerçant (devanture, intérieur, plat) → JPEG
 * paysage 1600×1067. Lève `PhotoReadError` si l'image est illisible.
 */
export async function photoFromUpload(image: UploadedImage): Promise<BrandPhoto> {
  const photo = image?.buffer?.length ? await normalizePhoto(image.buffer, "upload") : null;
  if (!photo) throw new PhotoReadError();
  return photo;
}

/**
 * Zone « photo » repérée par l'IA dans une capture (photo de couverture,
 * publication). Refusée si elle fait moins de 500 px de large dans l'image
 * d'origine : agrandie, elle serait floue sur la carte.
 */
export async function photoFromBox(
  input: Buffer,
  box: PhotoBox,
  source: BrandPhoto["source"] = "screenshot",
): Promise<BrandPhoto | null> {
  try {
    const d = await decode(input);
    if (!d) return null;
    const crop = await extractBox(d, box);
    if (!crop || crop.width * crop.scale < MIN_BOX_WIDTH) return null;
    return await encode(crop, source);
  } catch (err) {
    console.warn("[essai/photo] zone photo inexploitable:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── « Est-ce une photo ? » ───────────────────────────────────────────────

/**
 * Une vraie photo a beaucoup de nuances et pas de transparence ; un logo,
 * une bannière texte ou une illustration en aplats en a peu.
 */
async function looksLikePhoto(input: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(input, { failOn: "none", animated: false })
      .resize(96, 96, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const total = info.width * info.height;
    const bins = new Map<number, number>();
    let transparent = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) {
        transparent++;
        continue;
      }
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    if (transparent > total * 0.02) return false;
    const opaque = total - transparent;
    const counts = [...bins.values()].sort((a, b) => b - a);
    let covered = 0;
    let complexity = 0;
    for (const c of counts) {
      covered += c;
      complexity++;
      if (covered >= opaque * 0.85) break;
    }
    return complexity >= PHOTO_MIN_COMPLEXITY;
  } catch {
    return false;
  }
}

// ─── Photos du site ───────────────────────────────────────────────────────

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await safeFetch(url, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8",
    });
    if (res.status < 200 || res.status >= 300 || res.body.length === 0) return null;
    if (res.contentType.includes("html") || res.contentType.includes("svg")) return null;
    return res.body;
  } catch {
    return null;
  }
}

/**
 * Meilleure photo du site parmi les candidats (déjà triés par website.ts) :
 * la première assez grande (≥ 600 px), en paysage et qui est vraiment une
 * photo. Les premiers candidats sont téléchargés en parallèle.
 */
export async function pickWebsitePhoto(candidates: string[] | undefined): Promise<BrandPhoto | null> {
  const list = [...new Set(candidates ?? [])].slice(0, MAX_WEB_CANDIDATES);
  if (list.length === 0) return null;
  const downloads = await Promise.all(list.map((u) => download(u)));
  for (const bytes of downloads) {
    if (!bytes) continue;
    try {
      const meta = await sharp(bytes, { failOn: "none", animated: false }).metadata();
      const swap = (meta.orientation ?? 1) >= 5;
      const w = (swap ? meta.height : meta.width) ?? 0;
      const h = (swap ? meta.width : meta.height) ?? 0;
      if (w < MIN_WEB_WIDTH || h < MIN_WEB_HEIGHT || w / h < MIN_WEB_ASPECT) continue;
      if (!(await looksLikePhoto(bytes))) continue;
      const photo = await normalizePhoto(bytes, "website");
      if (photo) return photo;
    } catch {
      // Image illisible : candidat suivant.
    }
  }
  return null;
}

// ─── Google Places (API New) ──────────────────────────────────────────────

interface PlacesPhoto {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: { displayName?: string }[];
}

function placesKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? key : null;
}

function simplify(s: string): string {
  return normalizeForMatch(s).replace(/ /g, "");
}

async function placesJson(url: string, init: RequestInit, key: string): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), "X-Goog-Api-Key": key },
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`[essai/photo] Places API HTTP ${res.status}`);
    return null;
  }
  return res.json();
}

/**
 * Ordre de préférence : photos publiées par le commerce lui-même (auteur =
 * nom de la fiche : vitrine, plats mis en valeur), en paysage, puis les
 * autres photos paysage. Les photos portrait sont écartées.
 */
function rankPlacesPhotos(photos: PlacesPhoto[], businessName: string | null): string[] {
  const owner = businessName ? simplify(businessName) : "";
  return photos
    .map((p, i) => {
      const w = p.widthPx ?? 0;
      const h = p.heightPx ?? 0;
      const landscape = w > 0 && h > 0 ? w / h >= 1.2 : false;
      const byOwner =
        !!owner && (p.authorAttributions ?? []).some((a) => {
          const n = simplify(a.displayName ?? "");
          return !!n && (n === owner || n.includes(owner) || owner.includes(n));
        });
      return { name: p.name ?? "", score: (byOwner ? 10 : 0) + (landscape ? 5 : -100) - i * 0.1 };
    })
    .filter((p) => p.name && p.score > -50)
    .sort((a, b) => b.score - a.score)
    .map((p) => p.name);
}

/**
 * Photo de la fiche Google du commerce (Places API New, média photo).
 * `photoNames` (déjà connus via maps.ts) évite une requête ; sinon recherche
 * par `placeId` ou par texte (nom + adresse). null sans clé ou sans photo.
 */
export async function placesPhoto(opts: {
  photoNames?: string[] | null;
  placeId?: string | null;
  textQuery?: string | null;
  location?: { lat: number; lng: number } | null;
  businessName?: string | null;
}): Promise<BrandPhoto | null> {
  const key = placesKey();
  if (!key) return null;
  try {
    let names = (opts.photoNames ?? []).filter(Boolean);
    if (names.length === 0) {
      let photos: PlacesPhoto[] = [];
      if (opts.placeId) {
        const details = (await placesJson(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(opts.placeId)}`,
          { method: "GET", headers: { "X-Goog-FieldMask": "id,displayName,photos" } },
          key,
        )) as { photos?: PlacesPhoto[] } | null;
        photos = details?.photos ?? [];
      } else if (opts.textQuery?.trim()) {
        const body: Record<string, unknown> = { textQuery: opts.textQuery.trim(), languageCode: "fr", pageSize: 1 };
        if (opts.location) {
          body.locationBias = {
            circle: { center: { latitude: opts.location.lat, longitude: opts.location.lng }, radius: 500 },
          };
        }
        const res = (await placesJson(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-FieldMask": "places.id,places.photos" },
            body: JSON.stringify(body),
          },
          key,
        )) as { places?: { photos?: PlacesPhoto[] }[] } | null;
        photos = res?.places?.[0]?.photos ?? [];
      }
      names = rankPlacesPhotos(photos, opts.businessName ?? null);
    }

    for (const name of names.slice(0, 2)) {
      if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) continue;
      // Le média redirige vers l'image (googleusercontent) : fetch la suit.
      const res = await fetch(
        `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${PHOTO_WIDTH}&key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(PLACES_TIMEOUT_MS), cache: "no-store" },
      );
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) continue;
      const photo = await normalizePhoto(bytes, "places");
      if (photo) return photo;
    }
  } catch (err) {
    console.warn(`[essai/photo] Places photo indisponible (${err instanceof Error ? err.name : "erreur"})`);
  }
  return null;
}

/**
 * Noms des photos d'une fiche Places, classés (photos du commerce et
 * paysage d'abord). Pour maps.ts, qui reçoit déjà le champ `photos`.
 */
export function rankPlacesPhotoNames(photos: unknown, businessName: string | null): string[] {
  return Array.isArray(photos) ? rankPlacesPhotos(photos as PlacesPhoto[], businessName) : [];
}

// ─── Photo du métier (repli) ──────────────────────────────────────────────

/** Cache mémoire (même instance serverless) : URL CDN → photo normalisée. */
const stockCache = new Map<string, BrandPhoto>();
const STOCK_CACHE_MAX = 40;

async function fetchStock(url: string): Promise<BrandPhoto | null> {
  const cached = stockCache.get(url);
  if (cached) return cached;
  const bytes = await download(url);
  if (!bytes) return null;
  const photo = await normalizePhoto(bytes, "stock");
  if (photo) {
    if (stockCache.size >= STOCK_CACHE_MAX) {
      const oldest = stockCache.keys().next().value;
      if (oldest !== undefined) stockCache.delete(oldest);
    }
    stockCache.set(url, photo);
  }
  return photo;
}

/**
 * Dernier filet : fond dégradé aux couleurs de la marque (aucune police,
 * aucun réseau). Utilisé seulement si le CDN des photos est injoignable.
 */
async function gradientPhoto(colors?: BrandColors | null): Promise<BrandPhoto> {
  const a = colors?.background ?? "#1f2937";
  const b = colors?.accent ?? "#f59e0b";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_WIDTH}" height="${PHOTO_HEIGHT}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>` +
    `<radialGradient id="r" cx="0.8" cy="0.2" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/></svg>`;
  const jpeg = await sharp(Buffer.from(svg))
    .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
  return { jpeg, width: PHOTO_WIDTH, height: PHOTO_HEIGHT, source: "stock" };
}

/**
 * Photo du métier (plats, produits, vitrines, intérieurs vides — jamais de
 * personne). Ne lève jamais : sans réseau, fond dégradé aux couleurs.
 * `seed` (nom du commerce) : un même commerce retombe sur la même photo.
 */
export async function stockPhoto(
  category: EssaiCategory,
  seed: string,
  colors?: BrandColors | null,
): Promise<BrandPhoto> {
  for (const url of stockPhotoUrls(category, seed).slice(0, 2)) {
    const photo = await fetchStock(url);
    if (photo) return photo;
  }
  if (category !== "autre") {
    const photo = await fetchStock(stockPhotoUrls("autre", seed)[0]);
    if (photo) return photo;
  }
  return gradientPhoto(colors);
}
