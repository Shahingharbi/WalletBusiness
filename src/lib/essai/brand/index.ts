/**
 * Orchestrateur « votre carte en 30 secondes » : un lien (site, Google Maps,
 * Instagram / Facebook), des images (logo, photo de devanture, capture de
 * profil) et/ou un nom → profil de marque complet : nom, métier, couleurs
 * exactes, logo, PHOTO de bande (toujours), offre écrite pour le type de
 * carte choisi, promo, lien d'avis Google…
 *
 * Principe : chaque signal est un BONUS, et le chemin SANS IA doit déjà
 * donner un excellent résultat (l'offre gratuite de Gemini sature vite) :
 *  - fiche Google trouvée par le nom (Places API, sans IA) → vrai lien
 *    d'avis, adresse, site, photos, métier ;
 *  - site du commerce (bio, fiche) → logo HD, couleurs, photos ;
 *  - capture de profil → photo de profil recadrée (repérée sans IA si besoin) ;
 *  - pseudo nettoyé (« chickenspotfrance » → « Chicken Spot »).
 * L'IA n'est appelée que quand elle apporte vraiment : Gemini quand une IMAGE
 * doit être comprise (capture, photo ou logo seul), Groq pour les textes
 * (enseigne dont le site bloque les robots, métier inconnu). Tout échec
 * dégrade en silence — jamais la création de la carte, jamais un message
 * technique : seulement des `suggestions` douces (ajouter un logo, une photo,
 * une capture).
 *
 * Priorités :
 *  - NOM   : saisi > fiche Google (correspondance sûre) > IA > pseudo nettoyé
 *            (lien de site / Maps : saisi > fiche Maps > IA > site > domaine) ;
 *  - LOGO  : déposé > logo HD du site > photo de profil recadrée > favicon >
 *            initiales (un logo de site très horizontal passe après la photo
 *            de profil : illisible dans le badge carré / rond des wallets) ;
 *  - PHOTO : déposée > photos Google Places > photos du site > zone photo de
 *            la capture (≥ 500 px) > photo du métier (dernier recours).
 *
 * On ne lève une erreur que si l'entrée est vide (ni lien, ni image, ni nom).
 *
 * Server-only.
 */

import sharp from "sharp";
import {
  ESSAI_CARD_TYPES,
  type BrandInput,
  type BrandLogo,
  type BrandPhoto,
  type BrandProfile,
  type EssaiCardType,
  type EssaiCategory,
  type EssaiSource,
  type EssaiSuggestion,
  type MapsSignals,
  type PaletteColor,
  type UploadedImage,
  type WebsiteSignals,
} from "../types";
import {
  AI_IMAGE_BUDGET_MS,
  analyzeBrandWithAI,
  isAiConfigured,
  isTextAiConfigured,
  type AiBrandAnalysis,
  type AiBrandInput,
} from "./ai";
import {
  CATEGORY_PRESETS,
  PROMO_MAX,
  clampName,
  detectCategory,
  isOfferCoherent,
  isPromoCoherent,
  labelFitsReward,
  nameFromDomain,
  normalizeForMatch,
  offerFor,
} from "./category";
import { chooseBrandColors, deltaE, extractPalette } from "./colors";
import { cityFromHandle, isFacebookUrl, isInstagramUrl, parseFacebook, parseInstagram } from "./instagram";
import {
  googleFaviconCandidate,
  hasProfileAvatar,
  logoFromAvatar,
  logoFromImageWithSource,
  logoFromUploadWithSource,
  prepareLogoWithSource,
  typographicLogo,
  type PreparedLogo,
} from "./logo";
import { extractMapsSignals, findPlace, isGoogleMapsUrl, type FoundPlace } from "./maps";
import { normalizePhoto, photoFromBox, photoFromUpload, pickWebsitePhoto, placesPhoto, stockPhoto } from "./photo";
import { normalizeUserUrl } from "./safe-fetch";
import { extractWebsiteSignals } from "./website";

export { offerFor, promoMessageFor } from "./category";
export { logoFromUpload, LogoReadError } from "./logo";
export { photoFromUpload, PhotoReadError } from "./photo";

/** Collecte réseau (site, fiche Maps, fiche Google par le nom) avant les médias. */
const SIGNALS_BUDGET_MS = 14_000;
/** Temps minimal laissé aux logos / photos, même si la collecte a consommé son budget. */
const MEDIA_MIN_MS = 6_000;
/** Plafond de l'IA « vision » (Gemini a son propre budget de 25 s). */
const AI_VISION_CAP_MS = AI_IMAGE_BUDGET_MS + 1_000;
/** Plafond de l'IA « texte » (Groq répond en 1 à 3 s). */
const AI_TEXT_CAP_MS = 10_000;
/** Compléments après l'IA (site lu dans la bio, 2e recherche de fiche) : finis à ~30 s. */
const FOLLOW_UP_END_MS = 30_000;
/** Fin de l'analyse au plus tard (la route a `maxDuration = 60`). */
const TOTAL_BUDGET_MS = 45_000;
const FALLBACK_NAME = "Mon commerce";
/** Palette « fine » pour une capture / photo : le logo n'y couvre que quelques % des pixels. */
const FINE_PALETTE = { sampleSide: 256, minRatio: 0.003, maxColors: 12 } as const;
/** Métiers précis de la restauration : l'IA ou le nom affinent un type Places générique « restaurant ». */
const FOOD_SPECIFIC = new Set<EssaiCategory>(["kebab", "burger", "tacos", "chicken", "pizza", "sushi"]);

/**
 * Erreur « affichable » : `message` est en français, prêt pour l'utilisateur.
 * Levée seulement pour une entrée vide. `status` = code HTTP suggéré.
 */
export class BrandAnalysisError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "BrandAnalysisError";
    this.status = status;
  }
}

// ─── Utilitaires ──────────────────────────────────────────────────────────

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Attend `p` au plus `ms` ms ; ne lève jamais (timeout = échec). */
async function settle<T>(p: Promise<T>, ms: number): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Settled<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: new Error("budget dépassé") }), Math.max(0, ms));
  });
  try {
    return await Promise.race([
      p.then(
        (value): Settled<T> => ({ ok: true, value }),
        (error: unknown): Settled<T> => ({ ok: false, error }),
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Valeur de `p` dans le délai, sinon `fallback` (erreurs comprises). */
async function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  const r = await settle(p, ms);
  return r.ok ? r.value : fallback;
}

/** Noms génériques à ne jamais afficher comme nom de commerce. */
const GENERIC_NAMES = new Set([
  "accueil", "home", "homepage", "bienvenue", "welcome", "site officiel", "official site",
  "page d accueil", "index", "mon site", "site web", "website", "untitled", "sans titre",
]);

/** Nom propre (≤ 40 car., sans guillemets ni libellé générique) ou null. */
function cleanName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'«“”»\s]+|["'«“”»\s]+$/g, "")
    .trim();
  if (!s || GENERIC_NAMES.has(normalizeForMatch(s))) return null;
  return clampName(s, 40) || null;
}

const LOWERCASE_PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "à", "au", "aux", "en", "sur", "d", "l"]);

/**
 * Nom trouvé tout en minuscules (« le petit cambodge ») → « Le Petit
 * Cambodge ». Les noms qui ont déjà des majuscules sont un choix de marque.
 */
function capitalizeIfLowercase(name: string | null): string | null {
  if (!name || name !== name.toLocaleLowerCase("fr-FR") || !/\p{L}/u.test(name)) return name;
  return name
    .split(/(\s+|['’-])/)
    .map((w, i) => {
      if (!/\p{L}/u.test(w)) return w;
      if (i > 0 && LOWERCASE_PARTICLES.has(w)) return w;
      return w.charAt(0).toLocaleUpperCase("fr-FR") + w.slice(1);
    })
    .join("");
}

/** Forme compacte d'un nom pour comparer deux graphies (« Chicken spot » = « CHICKEN SPOT »). */
function compactName(name: string): string {
  return normalizeForMatch(name).replace(/ /g, "");
}

/**
 * Note de « typographie » d'un nom : majuscules initiales, accents (« Pâtisserie »
 * > « Patisserie »), ni tout en capitales ni tout en minuscules.
 */
function typographyScore(name: string): number {
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (!letters) return 0;
  let score = 0;
  if (letters === letters.toLocaleLowerCase("fr-FR")) score -= 3;
  else if (letters === letters.toLocaleUpperCase("fr-FR") && letters.length > 4) score -= 2;
  else score += 2;
  score += (name.match(/[À-ÿŒœ]/g) ?? []).length;
  // « Chicken spot » : un mot significatif sans majuscule au milieu d'un nom capitalisé.
  const words = name.split(/\s+/).filter((w) => /^\p{L}/u.test(w) && w.length > 3);
  if (words.some((w) => w[0] === w[0].toLocaleLowerCase("fr-FR")) && words.some((w) => w[0] !== w[0].toLocaleLowerCase("fr-FR"))) {
    score -= 1;
  }
  return score;
}

/**
 * Parmi des graphies du MÊME nom (même forme compacte que `primary`), la plus
 * soignée ; `primary` sinon.
 */
function bestSpelling(primary: string, ...alternatives: (string | null | undefined)[]): string {
  const key = compactName(primary);
  let best = primary;
  for (const alt of alternatives) {
    if (alt && compactName(alt) === key && typographyScore(alt) > typographyScore(best)) best = alt;
  }
  return best;
}

/** Prénom affiché « Bonjour <prénom> » (≤ 24 car.), majuscule initiale. */
function cleanFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\x00-\x1f\x7f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 24).trim();
  if (!s) return null;
  return s === s.toLowerCase() ? s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1) : s;
}

/** Une saisie qui n'est pas un lien mais ressemble à un nom (« Boulangerie Dupont »). */
function looksLikeName(raw: string): boolean {
  return raw.length <= 60 && !/[/@:]/.test(raw) && /\p{L}/u.test(raw);
}

/** Fichier de capture d'écran de téléphone (portrait très allongé). */
function isScreenshotShaped(width: number, height: number): boolean {
  return width >= 540 && height / width >= 1.6;
}

function hostnameOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/** Même site ? (domaine enregistrable : « restaurants.mcdonalds.fr » = « mcdonalds.fr »). */
function sameSite(a: string | null | undefined, b: string | null | undefined): boolean {
  const ha = hostnameOf(a).toLowerCase();
  const hb = hostnameOf(b).toLowerCase();
  if (!ha || !hb) return false;
  const root = (h: string) => h.split(".").slice(-2).join(".");
  return ha === hb || root(ha) === root(hb);
}

/** Lien de site propre pour la fiche (sans paramètres de suivi « utm_* »). */
function cleanWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    [...u.searchParams.keys()].filter((k) => /^utm_|^gclid$|^fbclid$/i.test(k)).forEach((k) => u.searchParams.delete(k));
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** « Nom — adresse » (fiche Google liée aux avis), sans « , France ». */
function reviewLabelOf(name: string | null | undefined, address: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  if (!n) return null;
  const a = (address ?? "").replace(/,\s*France\s*$/i, "").trim();
  return (a ? `${n} — ${a}` : n).slice(0, 160);
}

interface ReadyImage extends UploadedImage {
  width: number;
  height: number;
}

/** Image envoyée lisible (dimensions après orientation EXIF), sinon null. */
async function readImage(img: UploadedImage | null | undefined): Promise<ReadyImage | null> {
  if (!img?.buffer?.length) return null;
  try {
    const meta = await sharp(img.buffer, { failOn: "none", animated: false }).metadata();
    if (!meta.width || !meta.height) return null;
    const swap = (meta.orientation ?? 1) >= 5;
    return {
      buffer: img.buffer,
      mimeType: img.mimeType,
      width: swap ? meta.height : meta.width,
      height: swap ? meta.width : meta.height,
    };
  } catch {
    return null;
  }
}

/**
 * Ramène les couleurs choisies par l'IA sur la palette finale (mesurée sur
 * le logo retenu) : l'IA a pu voir une palette plus large (image entière).
 * Palette finale vide → on garde ses choix (mesurés, ou officiels pour une
 * enseigne connue).
 */
function snapToPalette(colors: (string | null)[], palette: PaletteColor[]): (string | null)[] {
  if (palette.length === 0) return colors;
  return colors.map((c) => {
    if (!c) return null;
    let best: string | null = null;
    let bestDelta = Infinity;
    for (const p of palette) {
      const d = deltaE(c, p.hex);
      if (d < bestDelta) {
        best = p.hex;
        bestDelta = d;
      }
    }
    return best && bestDelta < 15 ? best : null;
  });
}

const PNG = "image/png";

/**
 * Le site trouvé par une fiche Google est-il bien celui de l'enseigne ? Une
 * fiche peut pointer vers un domaine expiré ou redirigé (chickenspot.fr →
 * « Chickenshop ») : on exige le nom dans le domaine, le titre ou le texte.
 */
function siteMatchesBrand(site: WebsiteSignals, brand: string): boolean {
  const key = compactName(brand);
  if (key.length < 4) return true;
  const label = hostnameOf(site.finalUrl).split(".").slice(-2)[0] ?? "";
  const labelKey = compactName(label);
  const nameKey = compactName(site.name ?? "");
  const text = ` ${normalizeForMatch(`${site.name ?? ""} ${site.description ?? ""} ${site.textSample}`)} `;
  return (
    (labelKey.length >= 4 && (labelKey.includes(key) || key.includes(labelKey))) ||
    (nameKey.length >= 4 && (nameKey.includes(key) || key.includes(nameKey))) ||
    text.includes(` ${normalizeForMatch(brand)} `)
  );
}

/** Premier site (≤ 2 essayés) qui répond ET correspond à l'enseigne, sinon null. */
async function siteOfBrand(
  urls: string[],
  brand: string,
  budget: () => number,
): Promise<WebsiteSignals | null> {
  for (const candidate of urls.slice(0, 2)) {
    if (budget() < 1_500) break;
    const res = await settle(extractWebsiteSignals(candidate), budget());
    if (res.ok && siteMatchesBrand(res.value, brand)) return res.value;
    if (res.ok) console.info(`[essai/brand] site de la fiche écarté (${hostnameOf(res.value.finalUrl)} ≠ ${brand})`);
  }
  return null;
}

/** Logo nettement plus large que haut (≥ 3:1) : un « wordmark ». */
async function isWideLogo(source: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(source).metadata();
    return !!meta.width && !!meta.height && meta.width / meta.height >= 3;
  } catch {
    return false;
  }
}

/** Logos et photos tirés d'un site (et de son favicon). */
interface SiteMedia {
  webLogo: PreparedLogo | null;
  faviconLogo: PreparedLogo | null;
  photo: BrandPhoto | null;
}

/**
 * Logo HD (candidats du site, apple-touch-icon si le site bloque les robots),
 * favicon Google et photo du site, en parallèle dans `ms`.
 */
async function loadSiteMedia(
  site: WebsiteSignals | null,
  siteUrl: string | null,
  opts: { blocked: boolean; wantLogo: boolean; wantPhoto: boolean; ms: number },
): Promise<SiteMedia> {
  const host = hostnameOf(site?.finalUrl ?? siteUrl);
  const candidates = site?.logoCandidates ?? [];
  const blocked =
    opts.blocked && siteUrl
      ? [{ url: new URL("/apple-touch-icon.png", siteUrl).toString(), kind: "apple-touch-icon" as const, size: 180 }]
      : [];
  const favicon = host ? googleFaviconCandidate(host) : null;
  const ms = Math.max(1_000, opts.ms);
  const badgeHint = site?.themeColor ?? site?.manifestColors[0] ?? null;
  const [webLogo, faviconLogo, photo] = await Promise.all([
    opts.wantLogo && (candidates.length || blocked.length)
      ? within(prepareLogoWithSource([...candidates, ...blocked], { badgeHint }), ms, null)
      : Promise.resolve<PreparedLogo | null>(null),
    opts.wantLogo && favicon ? within(prepareLogoWithSource([favicon]), ms, null) : Promise.resolve<PreparedLogo | null>(null),
    opts.wantPhoto && site?.photoCandidates?.length
      ? within(pickWebsitePhoto(site.photoCandidates), ms, null)
      : Promise.resolve<BrandPhoto | null>(null),
  ]);
  return { webLogo, faviconLogo, photo };
}

// ─── Orchestrateur ────────────────────────────────────────────────────────

export async function analyzeBrand(input: BrandInput): Promise<BrandProfile> {
  const startedAt = Date.now();
  const signalsDeadline = startedAt + SIGNALS_BUDGET_MS;
  const followDeadline = startedAt + FOLLOW_UP_END_MS;
  const hardDeadline = startedAt + TOTAL_BUDGET_MS;
  const left = () => Math.max(0, hardDeadline - Date.now());
  const signalsLeft = () => Math.max(1_500, signalsDeadline - Date.now());
  const followLeft = () => Math.max(0, followDeadline - Date.now());
  const placesEnabled = Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());

  const cardType: EssaiCardType = ESSAI_CARD_TYPES.includes(input.cardType as EssaiCardType)
    ? (input.cardType as EssaiCardType)
    : "stamp";
  const firstName = cleanFirstName(input.firstName);
  let userName = cleanName(input.name);

  // 1. Images envoyées (lecture en parallèle) ─────────────────────────────
  const [logoUpload, photoUpload, screenshotUpload, legacy] = await Promise.all([
    readImage(input.logoImage),
    readImage(input.photoImage),
    readImage(input.screenshotImage),
    readImage(input.image),
  ]);
  let screenshot = screenshotUpload;
  /** Ancien champ unique : capture, logo ou photo — à classer. */
  let autoImage: ReadyImage | null = null;
  if (legacy) {
    if (!screenshot && isScreenshotShaped(legacy.width, legacy.height)) screenshot = legacy;
    else autoImage = legacy;
  }
  const anyImage = !!(logoUpload || photoUpload || screenshot || autoImage);

  // 2. Source ─────────────────────────────────────────────────────────────
  const rawUrl = (input.url ?? "").trim();
  const url = rawUrl ? normalizeUserUrl(rawUrl) : null;
  // Saisie qui n'est pas un lien (« Boulangerie Dupont ») : c'est un nom.
  if (rawUrl && !url && !userName && looksLikeName(rawUrl)) userName = cleanName(rawUrl);

  const social = !!url && (isInstagramUrl(url) || isFacebookUrl(url));
  let source: EssaiSource;
  if (url && social) source = "instagram";
  else if (url && isGoogleMapsUrl(url)) source = "maps";
  else if (url) source = "website";
  else if (anyImage) source = "photo";
  else if (userName) source = "name";
  else {
    throw new BrandAnalysisError(
      "Collez le lien de votre commerce (site, Google Maps, Instagram) ou ajoutez votre logo.",
    );
  }
  /** Sources sans site ni fiche : on part à la recherche de la fiche Google et du site. */
  const discoveryFlow = source === "instagram" || source === "photo" || source === "name";

  const profileHandle =
    source === "instagram" && url ? (isFacebookUrl(url) ? parseFacebook(url) : parseInstagram(url)) : null;
  const handleName = capitalizeIfLowercase(cleanName(profileHandle?.nameGuess));

  // 3. Préparation locale (rapide) : logo / photo déposés, image « auto », palette fine.
  const fineImage = screenshot ?? autoImage;
  const [uploadedLogo, uploadedPhoto, autoLogo, finePalette] = await Promise.all([
    logoUpload ? logoFromUploadWithSource(logoUpload).catch(() => null) : Promise.resolve<PreparedLogo | null>(null),
    photoUpload ? photoFromUpload(photoUpload).catch(() => null) : Promise.resolve<BrandPhoto | null>(null),
    // Ancien champ : est-ce un logo (peu de couleurs / transparence) ?
    autoImage ? logoFromImageWithSource(autoImage.buffer) : Promise.resolve<PreparedLogo | null>(null),
    fineImage ? extractPalette(fineImage.buffer, FINE_PALETTE) : Promise.resolve<PaletteColor[]>([]),
  ]);

  // 4. IA « vision » (Gemini), lancée tout de suite — seulement si une image
  //    doit être COMPRISE : capture de profil, image de nature inconnue, ou
  //    photo / logo qui sont la seule source (lire l'enseigne, le nom).
  let main: ReadyImage | null = null;
  let imageRole: AiBrandInput["imageRole"] = "auto";
  if (screenshot) {
    main = screenshot;
    imageRole = "screenshot";
  } else if (autoImage) {
    main = autoImage;
  } else if (!url && !userName && photoUpload) {
    main = photoUpload;
    imageRole = "storefront";
  } else if (!url && !userName && logoUpload) {
    main = logoUpload;
    imageRole = "logo";
  }
  const earlyCategory = detectCategory({ texts: [userName ?? handleName ?? "", profileHandle?.handle ?? ""] });
  const mainImage = main;
  const visionP: Promise<AiBrandAnalysis | null> =
    mainImage && isAiConfigured()
      ? (async () => {
          const aiPalette =
            uploadedLogo && mainImage !== logoUpload ? await extractPalette(uploadedLogo.source) : finePalette;
          return within(
            analyzeBrandWithAI({
              image: { buffer: mainImage.buffer, mimeType: mainImage.mimeType },
              imageRole,
              logo: uploadedLogo && mainImage !== logoUpload ? { buffer: uploadedLogo.source, mimeType: PNG } : null,
              name: userName ?? handleName,
              handle: profileHandle?.handle ?? null,
              texts: [userName ?? handleName ?? "", profileHandle ? `Profil : @${profileHandle.handle}` : ""],
              palette: aiPalette.map((c) => c.hex),
              source,
              cardType,
              domain: source === "website" ? hostnameOf(url) || null : null,
              categoryHint: earlyCategory,
            }),
            AI_VISION_CAP_MS,
            null,
          );
        })()
      : Promise.resolve(null);

  // 5. Signaux réseau, en parallèle de l'IA (jamais bloquants) ────────────
  // Affectés dans la collecte asynchrone : `as` évite que TypeScript les
  // considère comme toujours null / false ensuite.
  let website = null as WebsiteSignals | null;
  let maps = null as MapsSignals | null;
  let place = null as FoundPlace | null;
  let siteUnreadable = false as boolean;
  /** Site trouvé par la fiche Google (et non donné par le commerçant / la bio). */
  let siteFromPlace = false as boolean;
  let firstPlaceQuery = null as string | null;

  const discovery = (async () => {
    if (source === "maps" && url) {
      const res = await settle(extractMapsSignals(url), signalsLeft());
      if (res.ok) maps = res.value;
      // Le site du commerce (connu grâce à la fiche) apporte logo, couleurs, photo.
      if (maps?.website) {
        const res2 = await settle(extractWebsiteSignals(maps.website), signalsLeft());
        if (res2.ok) website = res2.value;
      }
    } else if (source === "website" && url) {
      const res = await settle(extractWebsiteSignals(url), signalsLeft());
      if (res.ok) website = res.value;
      else siteUnreadable = true;
    }

    // Fiche Google par le nom (lien d'avis, adresse, photos, site) — sans IA.
    if (placesEnabled && !maps) {
      const siteUrl = website?.finalUrl ?? (source === "website" ? url : null);
      const query =
        userName ??
        handleName ??
        (source === "website" ? (cleanName(website?.name) ?? cleanName(nameFromDomain(hostnameOf(siteUrl)))) : null);
      if (query) {
        firstPlaceQuery = query;
        // Ville du pseudo (« lafabrique.bordeaux ») : départage les homonymes.
        const handleCity = !userName && query === handleName ? cityFromHandle(profileHandle?.handle) : null;
        place = await within(
          findPlace({ name: query, city: handleCity, website: siteUrl, location: website?.location ?? null }),
          signalsLeft(),
          null,
        );
      }
    }
    // Site découvert par la fiche (sources sans site), si la fiche est sûre.
    if (discoveryFlow && !website && place?.confidence === "sure") {
      website = await siteOfBrand(place.websites, place.brandName, signalsLeft);
      siteFromPlace = !!website;
    }

    // Médias du site et de la fiche, en parallèle.
    const mediaMs = Math.max(MEDIA_MIN_MS, signalsDeadline - Date.now());
    const siteUrl = website?.finalUrl ?? maps?.website ?? (source === "website" ? url : null);
    const [siteMedia, placePhoto] = await Promise.all([
      loadSiteMedia(website, siteUrl, {
        blocked: siteUnreadable,
        wantLogo: !logoUpload,
        wantPhoto: !photoUpload,
        ms: mediaMs,
      }),
      !photoUpload && (maps?.photoNames?.length || maps?.placeId || place?.photoNames.length)
        ? within(
            placesPhoto({
              photoNames: maps?.photoNames?.length ? maps.photoNames : (place?.photoNames ?? null),
              placeId: maps?.placeId ?? null,
              businessName: maps?.name ?? place?.brandName ?? null,
            }),
            Math.min(8_000, mediaMs),
            null,
          )
        : Promise.resolve<BrandPhoto | null>(null),
    ]);
    return { siteMedia, placePhoto };
  })().catch((err: unknown) => {
    console.warn("[essai/brand] collecte réseau interrompue:", err instanceof Error ? err.message : err);
    return { siteMedia: { webLogo: null, faviconLogo: null, photo: null } as SiteMedia, placePhoto: null };
  });

  const [{ siteMedia: firstMedia, placePhoto: firstPlacePhoto }, vision] = await Promise.all([discovery, visionP]);
  let { webLogo, faviconLogo } = firstMedia;
  let sitePhoto = firstMedia.photo;
  let placePhotoResult = firstPlacePhoto;
  let ai: AiBrandAnalysis | null = vision;

  // 6. Compléments grâce à l'IA (site de la bio, ville, vrai nom) ─────────
  const aiSite = ai?.website ? normalizeUserUrl(ai.website) : null;
  if (ai && followLeft() > 1_500) {
    const aiName = cleanName(ai.businessName);
    // a) Fiche Google plus sûre avec le nom lu, la ville et le site de la bio.
    const query = userName ?? aiName ?? handleName;
    if (
      placesEnabled &&
      !maps &&
      place?.confidence !== "sure" &&
      query &&
      (query !== firstPlaceQuery || ai.city || aiSite)
    ) {
      const better = await within(
        findPlace({ name: query, city: ai.city ?? null, website: aiSite ?? website?.finalUrl ?? null }),
        followLeft(),
        null,
      );
      if (better && (!place || better.confidence === "sure")) {
        place = better;
        placePhotoResult = null;
      }
    }
    // b) Site affiché dans la bio (ou de la nouvelle fiche) : logo HD et photos.
    const placeSites = discoveryFlow && place?.confidence === "sure" ? place.websites : [];
    const needSite =
      (!!aiSite && (!website || (siteFromPlace && !sameSite(website.finalUrl, aiSite)))) ||
      (!aiSite && !website && placeSites.length > 0);
    const followUps: Promise<void>[] = [];
    if (needSite && followLeft() > 1_500) {
      const brand = place?.brandName ?? aiName ?? handleName ?? "";
      followUps.push(
        (async () => {
          // Site de la bio : affiché par le commerce lui-même, pas de contrôle.
          let found: WebsiteSignals | null = null;
          if (aiSite) {
            const res = await settle(extractWebsiteSignals(aiSite), followLeft());
            found = res.ok ? res.value : null;
          } else {
            found = await siteOfBrand(placeSites, brand, followLeft);
          }
          if (!found) return;
          website = found;
          siteFromPlace = !aiSite;
          const media = await loadSiteMedia(website, website.finalUrl, {
            blocked: false,
            wantLogo: !logoUpload,
            wantPhoto: !photoUpload,
            ms: Math.max(2_000, followLeft()),
          });
          webLogo = media.webLogo ?? webLogo;
          faviconLogo = media.faviconLogo ?? faviconLogo;
          sitePhoto = media.photo ?? sitePhoto;
        })(),
      );
    }
    // c) Photos de la nouvelle fiche.
    if (!photoUpload && !placePhotoResult && place?.photoNames.length && followLeft() > 1_500) {
      const p = place;
      followUps.push(
        (async () => {
          placePhotoResult = await within(
            placesPhoto({ photoNames: p.photoNames, businessName: p.brandName }),
            Math.max(2_000, followLeft()),
            null,
          );
        })(),
      );
    }
    await Promise.all(followUps);
  }

  // 7. Métier sans IA ─────────────────────────────────────────────────────
  const host = hostnameOf(website?.finalUrl ?? maps?.website ?? (source === "website" ? url : null));
  const hostName = host ? nameFromDomain(host) : "";
  const signalName = capitalizeIfLowercase(
    cleanName(maps?.name) ?? cleanName(website?.name) ?? handleName ?? null,
  );
  const categoryTexts = [
    userName ?? signalName ?? hostName,
    website?.description ?? "",
    website?.textSample ?? "",
    profileHandle?.handle ?? "",
  ];
  const categoryTypes = [...(maps?.types ?? []), ...(place?.types ?? []), ...(website?.jsonLdTypes ?? [])];
  const heuristicCategory = detectCategory({ texts: categoryTexts, types: categoryTypes });
  // Types structurés (JSON-LD, Places) : très fiables, l'IA ne les contredit pas…
  const typedCategory = categoryTypes.length ? detectCategory({ texts: [], types: categoryTypes }) : "autre";
  // … sauf pour préciser un « restaurant » générique (« Chicken Spot » → chicken).
  const textCategory = detectCategory({ texts: categoryTexts });

  // 8. IA « texte » (Groq) : pas d'IA vision, et un vrai besoin — site qui
  //    bloque les robots (connaissance d'enseigne) ou métier inconnu.
  const siteLogo = webLogo ?? faviconLogo;
  if (!ai && isTextAiConfigured() && left() > 6_000) {
    const preCategory = typedCategory !== "autre" ? typedCategory : heuristicCategory;
    if (siteUnreadable || preCategory === "autre") {
      const palette = uploadedLogo
        ? await extractPalette(uploadedLogo.source)
        : siteLogo
          ? await extractPalette(siteLogo.source)
          : finePalette;
      ai = await within(
        analyzeBrandWithAI({
          name: userName ?? signalName,
          handle: profileHandle?.handle ?? null,
          texts: [
            signalName ?? "",
            profileHandle ? `Profil : @${profileHandle.handle}` : "",
            website?.description ?? "",
            maps?.address || place?.address ? `Adresse : ${maps?.address ?? place?.address}` : "",
            website?.textSample ?? "",
          ],
          palette: palette.map((c) => c.hex),
          source,
          cardType,
          domain: host || null,
          siteUnreadable,
          categoryHint: preCategory,
          budgetMs: Math.min(AI_TEXT_CAP_MS, left() - 4_000),
        }),
        Math.min(AI_TEXT_CAP_MS, left() - 3_000),
        null,
      );
    }
  }

  // Nature de l'image « auto » : l'IA tranche ; sinon logo s'il en a l'air,
  // capture si une photo de profil ronde y est repérée, sinon photo.
  let autoKind: "screenshot" | "logo" | "photo" | null = null;
  if (autoImage) {
    if (vision?.imageKind === "screenshot") autoKind = "screenshot";
    else if (vision?.imageKind === "logo") autoKind = "logo";
    else if (vision) autoKind = "photo";
    else if (autoLogo) autoKind = "logo";
    else autoKind = (await hasProfileAvatar(autoImage.buffer)) ? "screenshot" : "photo";
  }
  /** Image principale vue par l'IA (ses zones `logoBox` / `photoBox` s'y rapportent). */
  const aiMain: ReadyImage | null = vision ? main : null;
  const profileShot = screenshot ?? (autoKind === "screenshot" ? autoImage : null);

  // 9. Logo retenu ────────────────────────────────────────────────────────
  //    déposé > image « auto » si c'est un logo > logo HD du site > photo de
  //    profil (zone de l'IA, ou repérée sans IA) > favicon > logo lisible sur
  //    une photo d'enseigne.
  let chosen: PreparedLogo | null = uploadedLogo;
  if (!chosen && autoImage && autoKind === "logo") {
    chosen = autoLogo ?? (await logoFromImageWithSource(autoImage.buffer, { x: 0, y: 0, w: 1, h: 1 }));
  }
  // Logo du site très horizontal (« wordmark ») : illisible dans un badge
  // carré / rond de wallet — la photo de profil (emblème) passe devant.
  const wordmark = !chosen && webLogo && profileShot ? await isWideLogo(webLogo.source) : false;
  if (!chosen && webLogo && !wordmark) chosen = webLogo;
  if (!chosen && profileShot) {
    const box = vision && aiMain === profileShot ? vision.logoBox : null;
    chosen = await logoFromAvatar(profileShot.buffer, box);
  }
  if (!chosen && webLogo) chosen = webLogo;
  if (!chosen && faviconLogo) chosen = faviconLogo;
  if (!chosen && vision?.logoBox && aiMain && aiMain !== profileShot) {
    chosen = await logoFromImageWithSource(aiMain.buffer, vision.logoBox);
  }

  // 10. Palette mesurée : sur le logo retenu ; sinon sur la photo d'enseigne
  //     (jamais sur une capture sans IA : on y mesurerait l'interface).
  let palette: PaletteColor[] = [];
  if (chosen) palette = await extractPalette(chosen.source);
  else if (autoImage && autoKind === "photo") palette = await extractPalette(autoImage.buffer);
  else if (photoUpload) palette = await extractPalette(photoUpload.buffer);

  // 11. Métier final, nom ─────────────────────────────────────────────────
  let category: EssaiCategory = heuristicCategory;
  if (typedCategory !== "autre") category = typedCategory;
  else if (ai && ai.category !== "autre") category = ai.category;
  if (category === "restaurant") {
    if (ai && FOOD_SPECIFIC.has(ai.category)) category = ai.category;
    else if (FOOD_SPECIFIC.has(textCategory)) category = textCategory;
  }
  // Métier écrit par le commerçant lui-même (« Boulangerie Paul ») : prime
  // sur les types Google de la fiche (PAUL = bakery + cake_shop…).
  const nameCategory = userName ? detectCategory({ texts: [userName] }) : "autre";
  if (nameCategory !== "autre" && nameCategory !== "restaurant") category = nameCategory;

  const aiName = cleanName(ai?.businessName);
  const placeName = place?.confidence === "sure" ? cleanName(place.brandName) : null;
  let name: string;
  if (userName) {
    name = userName;
  } else if (discoveryFlow) {
    const picked = placeName ?? aiName ?? handleName ?? cleanName(website?.name) ?? null;
    name = picked ? bestSpelling(picked, aiName, handleName, placeName) : FALLBACK_NAME;
  } else {
    // Lien de site / Maps : la fiche Google trouvée par le site ne passe
    // qu'avant le nom tiré du domaine (« mcdonalds.fr » → « McDonald's »).
    const picked =
      (maps?.placesApiUsed ? cleanName(maps.name) : null) ??
      aiName ??
      signalName ??
      placeName ??
      cleanName(hostName);
    name = picked ? bestSpelling(picked, placeName, aiName) : FALLBACK_NAME;
  }
  name = capitalizeIfLowercase(name) ?? name;

  // 12. Couleurs ──────────────────────────────────────────────────────────
  // Enseigne connue (McDonald's…) : ses couleurs officielles priment sur la
  // palette mesurée, souvent faussée par un favicon de déclinaison (ex. arches
  // sur fond vert) — sinon on recale l'IA sur les pixels réellement mesurés.
  const preferred = ai
    ? ai.knownBrand === true
      ? [ai.primaryColor, ai.secondaryColor]
      : snapToPalette([ai.primaryColor, ai.secondaryColor], palette)
    : [];
  const colors = chooseBrandColors({
    palette,
    themeColor: website?.themeColor ?? null,
    manifestColors: website?.manifestColors ?? [],
    preferred,
  });

  // 13. Logo final (vrai logo, sinon initiales) ───────────────────────────
  const logo: BrandLogo = chosen?.logo ?? (await typographicLogo(name, colors));

  // 14. Photo de la bande (obligatoire) ───────────────────────────────────
  //     déposée > fiche Google > site > zone photo de la capture > métier.
  const seed = url ?? userName ?? name;
  let photo: BrandPhoto | null = uploadedPhoto;
  if (!photo && autoImage && autoKind === "photo") photo = await normalizePhoto(autoImage.buffer, "upload");
  if (!photo) photo = placePhotoResult ?? sitePhoto;
  if (!photo && profileShot && aiMain === profileShot && vision?.photoBox) {
    photo = await photoFromBox(profileShot.buffer, vision.photoBox, "screenshot");
  }
  if (!photo) photo = await stockPhoto(category, seed, colors);

  // 15. Offre & promo (métier × type de carte) ────────────────────────────
  const preset = CATEGORY_PRESETS[category] ?? CATEGORY_PRESETS.autre;
  const offer = offerFor(category, cardType, name);
  // L'IA a écrit pour SON métier : on ne garde ses textes que s'il est retenu.
  const aiTextsFit = !!ai && ai.category === category;
  const aiReward = aiTextsFit ? ai?.rewardText?.trim() ?? "" : "";
  let rewardText = offer.rewardText;
  let labelStamps = offer.labelStamps;
  if (aiReward && isOfferCoherent(aiReward, cardType, offer.stampCount)) {
    if (cardType !== "stamp") {
      rewardText = aiReward;
    } else {
      // Tampons : le compteur doit parler de la même chose que l'offre.
      const aiLabel = ai?.labelStamps?.trim() ?? "";
      if (aiLabel && /^[\p{L}' -]{3,12}$/u.test(aiLabel) && labelFitsReward(aiLabel, aiReward)) {
        rewardText = aiReward;
        labelStamps = aiLabel.charAt(0).toLocaleUpperCase("fr-FR") + aiLabel.slice(1);
      } else if (labelFitsReward(offer.labelStamps, aiReward)) {
        rewardText = aiReward;
      }
    }
  }
  const aiPromo = aiTextsFit ? ai?.promoMessage?.trim() ?? "" : "";
  const promoMessage =
    aiPromo &&
    aiPromo.length <= PROMO_MAX &&
    normalizeForMatch(aiPromo).includes(normalizeForMatch(name)) &&
    isPromoCoherent(aiPromo, cardType)
      ? aiPromo
      : offer.promoMessage;

  // 16. Suggestions douces ────────────────────────────────────────────────
  const suggestions: EssaiSuggestion[] = [];
  if (logo.kind === "typographic") suggestions.push("add_logo");
  if (photo.source === "stock") suggestions.push("add_photo");
  if (source === "instagram" && !screenshot && !autoImage && logo.kind !== "real") suggestions.push("add_screenshot");

  // 17. Fiche Google, adresse, site ───────────────────────────────────────
  const reviewUrl = maps?.reviewUrl ?? place?.reviewUrl ?? null;
  const reviewLabel = maps?.reviewUrl
    ? maps.placesApiUsed
      ? reviewLabelOf(maps.name, maps.address)
      : null
    : place
      ? reviewLabelOf(place.name, place.address)
      : null;
  const websiteUrl = cleanWebsiteUrl(
    maps?.website ??
      (source === "website" ? (website?.finalUrl ?? url) : null) ??
      website?.finalUrl ??
      aiSite,
  );

  const profile: BrandProfile = {
    source,
    sourceUrl: url,
    name,
    category,
    colors,
    palette: palette.map((c) => c.hex),
    logo,
    rewardText,
    stampCount: offer.stampCount,
    stampIcon: preset.stampIcon,
    stampShape: preset.stampShape,
    labelStamps,
    promoMessage,
    reviewUrl,
    address: maps?.address ?? place?.address ?? website?.address ?? null,
    location: maps?.location ?? place?.location ?? website?.location ?? null,
    website: websiteUrl,
    aiUsed: ai !== null,
    cardType,
    photo,
    firstName,
    suggestions,
    reviewLabel,
  };

  console.info(
    `[essai/brand] source=${source} métier=${category} type=${cardType} logo=${logo.kind} photo=${photo.source} ia=${vision ? "vision" : ai ? "texte" : "non"} fiche=${place ? place.confidence : maps?.placesApiUsed ? "maps" : "non"}${siteUnreadable ? " site=illisible" : ""} durée=${Date.now() - startedAt}ms`,
  );
  return profile;
}
