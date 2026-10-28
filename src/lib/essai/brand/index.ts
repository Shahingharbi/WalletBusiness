/**
 * Orchestrateur « votre carte en 30 secondes » : un lien (site, Google Maps,
 * Instagram / Facebook), des images (logo, photo de devanture, capture de
 * profil) et/ou un nom → profil de marque complet : nom, métier, couleurs
 * exactes, logo, PHOTO de bande (toujours), offre écrite pour le type de
 * carte choisi, promo, lien d'avis…
 *
 * Principe : chaque signal est un BONUS. Un site qui bloque les robots, une
 * fiche Maps sans API, une IA absente ou une photo floue dégradent le
 * résultat en silence (repli : favicon Google, connaissance de marque de
 * l'IA, nom tiré du domaine, photo du métier) — jamais la création de la
 * carte, et jamais un message technique pour le commerçant : seulement des
 * `suggestions` douces (ajouter un logo, une photo, une capture).
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
import { analyzeBrandWithAI, isAiConfigured, type AiBrandAnalysis, type AiBrandInput } from "./ai";
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
import { isFacebookUrl, isInstagramUrl, parseFacebook, parseInstagram } from "./instagram";
import {
  googleFaviconCandidate,
  logoFromAvatar,
  logoFromImageWithSource,
  logoFromUploadWithSource,
  prepareLogoWithSource,
  typographicLogo,
  type PreparedLogo,
} from "./logo";
import { extractMapsSignals, isGoogleMapsUrl } from "./maps";
import { normalizePhoto, photoFromBox, photoFromUpload, pickWebsitePhoto, placesPhoto, stockPhoto } from "./photo";
import { normalizeUserUrl } from "./safe-fetch";
import { extractWebsiteSignals } from "./website";

export { offerFor, promoMessageFor } from "./category";
export { logoFromUpload, LogoReadError } from "./logo";
export { photoFromUpload, PhotoReadError } from "./photo";

/** Budget de collecte des signaux réseau (site, fiche Maps). */
const SIGNALS_BUDGET_MS = 18_000;
/** Temps minimal laissé aux logos / photos, même si la collecte a consommé son budget. */
const MEDIA_MIN_MS = 8_000;
/** Plafond IA (Gemini a son propre délai de 15 s). */
const AI_MAX_MS = 16_000;
/** Fin de l'analyse au plus tard (la route a `maxDuration = 60`). */
const TOTAL_BUDGET_MS = 48_000;
const FALLBACK_NAME = "Mon commerce";
/** Palette « fine » pour une capture / photo : le logo n'y couvre que quelques % des pixels. */
const FINE_PALETTE = { sampleSide: 256, minRatio: 0.003, maxColors: 12 } as const;

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

// ─── Orchestrateur ────────────────────────────────────────────────────────

export async function analyzeBrand(input: BrandInput): Promise<BrandProfile> {
  const startedAt = Date.now();
  const signalsDeadline = startedAt + SIGNALS_BUDGET_MS;
  const hardDeadline = startedAt + TOTAL_BUDGET_MS;
  const left = () => Math.max(0, hardDeadline - Date.now());

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

  // 3. Signaux réseau (jamais bloquants) ──────────────────────────────────
  let website: WebsiteSignals | null = null;
  let maps: MapsSignals | null = null;
  let profileHandle: { handle: string; nameGuess: string } | null = null;
  let siteUnreadable = false;
  const remaining = () => Math.max(1_500, signalsDeadline - Date.now());

  if (source === "instagram" && url) {
    profileHandle = isFacebookUrl(url) ? parseFacebook(url) : parseInstagram(url);
  } else if (source === "maps" && url) {
    const res = await settle(extractMapsSignals(url), remaining());
    if (res.ok) maps = res.value;
    // Le site du commerce (connu grâce à la fiche) apporte logo, couleurs, photo.
    if (maps?.website) {
      const res2 = await settle(extractWebsiteSignals(maps.website), remaining());
      if (res2.ok) website = res2.value;
    }
  } else if (source === "website" && url) {
    const res = await settle(extractWebsiteSignals(url), remaining());
    if (res.ok) website = res.value;
    else siteUnreadable = true;
  }

  const siteUrl = website?.finalUrl ?? maps?.website ?? (source === "website" ? url : null);
  const host = hostnameOf(siteUrl);
  const hostName = host ? nameFromDomain(host) : "";
  const signalName = capitalizeIfLowercase(
    cleanName(maps?.name) ?? cleanName(website?.name) ?? cleanName(profileHandle?.nameGuess) ?? null,
  );
  const seed = url ?? userName ?? signalName ?? "";

  // 4. Logos, photos, palettes : en parallèle ─────────────────────────────
  const mediaBudget = Math.max(MEDIA_MIN_MS, signalsDeadline - Date.now());
  const favicon = host ? googleFaviconCandidate(host) : null;
  const siteCandidates = website?.logoCandidates ?? [];
  const blockedCandidates =
    siteUnreadable && siteUrl
      ? [{ url: new URL("/apple-touch-icon.png", siteUrl).toString(), kind: "apple-touch-icon" as const, size: 180 }]
      : [];

  const uploadedLogoP = logoUpload
    ? logoFromUploadWithSource(logoUpload).catch(() => null)
    : Promise.resolve<PreparedLogo | null>(null);
  const webLogoP =
    !logoUpload && (siteCandidates.length || blockedCandidates.length)
      ? within(prepareLogoWithSource([...siteCandidates, ...blockedCandidates]), mediaBudget, null)
      : Promise.resolve<PreparedLogo | null>(null);
  const faviconLogoP =
    !logoUpload && favicon
      ? within(prepareLogoWithSource([favicon]), mediaBudget, null)
      : Promise.resolve<PreparedLogo | null>(null);
  // Ancien champ : est-ce un logo (peu de couleurs / transparence) ?
  const autoLogoP = autoImage
    ? logoFromImageWithSource(autoImage.buffer)
    : Promise.resolve<PreparedLogo | null>(null);
  const uploadedPhotoP = photoUpload
    ? photoFromUpload(photoUpload).catch(() => null)
    : Promise.resolve<BrandPhoto | null>(null);
  const websitePhotoP =
    !photoUpload && website?.photoCandidates?.length
      ? within(pickWebsitePhoto(website.photoCandidates), mediaBudget, null)
      : Promise.resolve<BrandPhoto | null>(null);
  // Palette fine de la capture / de l'image auto (pour que l'IA y choisisse).
  const fineImage = screenshot ?? autoImage;
  const finePaletteP = fineImage ? extractPalette(fineImage.buffer, FINE_PALETTE) : Promise.resolve([]);

  const [uploadedLogo, webLogo, faviconLogo, autoLogo, uploadedPhoto, websitePhotoRaw, finePalette] =
    await Promise.all([uploadedLogoP, webLogoP, faviconLogoP, autoLogoP, uploadedPhotoP, websitePhotoP, finePaletteP]);

  // Photo Google Places : seulement s'il n'y a ni photo déposée ni photo du site.
  let candidatePhoto: BrandPhoto | null = websitePhotoRaw;
  if (!uploadedPhoto && !candidatePhoto && !screenshot && process.env.GOOGLE_PLACES_API_KEY?.trim()) {
    const name = userName ?? signalName;
    const placeAddress = maps?.address ?? website?.address ?? null;
    const placeLocation = maps?.location ?? website?.location ?? null;
    candidatePhoto = await within(
      placesPhoto({
        photoNames: maps?.photoNames,
        placeId: maps?.placeId ?? null,
        // Recherche par texte seulement si l'on sait OÙ chercher (adresse ou
        // coordonnées) : un nom seul ramènerait la photo d'un homonyme.
        textQuery:
          maps?.photoNames?.length || maps?.placeId || !(placeAddress || placeLocation)
            ? null
            : [name, placeAddress].filter(Boolean).join(", "),
        location: placeLocation,
        businessName: name,
      }),
      Math.min(8_000, left()),
      null,
    );
  }

  // 5. Métier sans IA ─────────────────────────────────────────────────────
  const categoryTexts = [
    userName ?? signalName ?? hostName,
    website?.description ?? "",
    website?.textSample ?? "",
    profileHandle?.handle ?? "",
  ];
  const categoryTypes = [...(maps?.types ?? []), ...(website?.jsonLdTypes ?? [])];
  const heuristicCategory = detectCategory({ texts: categoryTexts, types: categoryTypes });
  // Types structurés (JSON-LD, Places) : très fiables, l'IA ne les contredit pas.
  const typedCategory = categoryTypes.length ? detectCategory({ texts: [], types: categoryTypes }) : "autre";

  // Photo du métier préchargée pendant l'IA (si aucune autre photo en vue).
  const needsStock = !uploadedPhoto && !candidatePhoto && !screenshot && !autoImage;
  const stockPrefetch = needsStock ? stockPhoto(heuristicCategory, seed) : null;

  // 6. IA : un seul appel ─────────────────────────────────────────────────
  const siteLogo = webLogo ?? faviconLogo;
  let ai: AiBrandAnalysis | null = null;
  if (isAiConfigured() && left() > 4_000) {
    let main: AiBrandInput["image"] = null;
    let imageRole: AiBrandInput["imageRole"] = "auto";
    if (screenshot) {
      main = screenshot;
      imageRole = "screenshot";
    } else if (autoImage) {
      main = autoImage;
    } else if (photoUpload) {
      main = photoUpload;
      imageRole = "storefront";
    } else if (logoUpload) {
      main = logoUpload;
      imageRole = "logo";
    }
    const logoForAi = uploadedLogo && main !== logoUpload ? uploadedLogo : !main ? siteLogo : null;
    // Palette proposée : logo déposé > capture / image (fine) > logo du site.
    const aiPalette = uploadedLogo
      ? await extractPalette(uploadedLogo.source)
      : fineImage
        ? finePalette
        : siteLogo
          ? await extractPalette(siteLogo.source)
          : [];
    const res = await settle(
      analyzeBrandWithAI({
        image: main ? { buffer: main.buffer, mimeType: main.mimeType } : null,
        imageRole,
        logo: logoForAi ? { buffer: logoForAi.source, mimeType: PNG } : null,
        photoCandidate: candidatePhoto?.jpeg ?? null,
        name: userName ?? signalName,
        texts: [
          signalName ?? "",
          profileHandle ? `Profil : @${profileHandle.handle}` : "",
          website?.description ?? "",
          maps?.address ? `Adresse : ${maps.address}` : "",
          website?.textSample ?? "",
        ],
        palette: aiPalette.map((c) => c.hex),
        source,
        cardType,
        domain: host || null,
        siteUnreadable,
        categoryHint: heuristicCategory,
      }),
      Math.min(AI_MAX_MS, left()),
    );
    ai = res.ok ? res.value : null;
  }

  // Nature de l'image « auto » : l'IA tranche ; sinon logo s'il en a l'air, sinon photo.
  const autoKind: "screenshot" | "logo" | "photo" | null = !autoImage
    ? null
    : ai?.imageKind === "screenshot"
      ? "screenshot"
      : ai?.imageKind === "logo" || (!ai && autoLogo)
        ? "logo"
        : "photo";
  /** Image principale vue par l'IA (ses zones `logoBox` / `photoBox` s'y rapportent). */
  const aiMain: ReadyImage | null = screenshot ?? autoImage ?? photoUpload ?? null;
  const profileShot = screenshot ?? (autoKind === "screenshot" ? autoImage : null);

  // 7. Logo retenu ────────────────────────────────────────────────────────
  //    déposé > photo de profil (capture) > image « auto » si c'est un logo >
  //    logo du site > favicon Google > logo lisible sur une photo d'enseigne.
  let chosen: PreparedLogo | null = uploadedLogo;
  if (!chosen && profileShot && ai?.logoBox) chosen = await logoFromAvatar(profileShot.buffer, ai.logoBox);
  if (!chosen && autoImage && autoKind === "logo") {
    chosen = autoLogo ?? (await logoFromImageWithSource(autoImage.buffer, { x: 0, y: 0, w: 1, h: 1 }));
  }
  if (!chosen && webLogo) chosen = webLogo;
  if (!chosen && faviconLogo) chosen = faviconLogo;
  if (!chosen && ai?.logoBox && aiMain && aiMain !== profileShot) {
    chosen = await logoFromImageWithSource(aiMain.buffer, ai.logoBox);
  }

  // 8. Palette mesurée : sur le logo retenu ; sinon sur la photo d'enseigne
  //    (jamais sur une capture sans IA : on y mesurerait l'interface).
  let palette: PaletteColor[] = [];
  if (chosen) palette = await extractPalette(chosen.source);
  else if (autoImage && autoKind === "photo") palette = await extractPalette(autoImage.buffer);
  else if (photoUpload) palette = await extractPalette(photoUpload.buffer);

  // 9. Métier final, nom ──────────────────────────────────────────────────
  let category: EssaiCategory = heuristicCategory;
  if (typedCategory !== "autre") category = typedCategory;
  else if (ai && ai.category !== "autre") category = ai.category;

  const aiName = cleanName(ai?.businessName);
  const name =
    userName ??
    (maps?.placesApiUsed ? cleanName(maps.name) : null) ??
    aiName ??
    signalName ??
    cleanName(hostName) ??
    FALLBACK_NAME;

  // 10. Couleurs ──────────────────────────────────────────────────────────
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

  // 11. Logo final (vrai logo, sinon initiales) ───────────────────────────
  const logo: BrandLogo = chosen?.logo ?? (await typographicLogo(name, colors));

  // 12. Photo de la bande (obligatoire) ───────────────────────────────────
  let photo: BrandPhoto | null = uploadedPhoto;
  if (!photo && autoImage && autoKind === "photo") photo = await normalizePhoto(autoImage.buffer, "upload");
  if (!photo && profileShot && ai?.photoBox) photo = await photoFromBox(profileShot.buffer, ai.photoBox, "screenshot");
  // Photo trouvée en ligne : validée par l'IA quand elle est là (aucune personne).
  if (!photo && candidatePhoto && (ai ? ai.photoCandidateOk === true : true)) photo = candidatePhoto;
  if (!photo) {
    const prefetched = stockPrefetch && category === heuristicCategory ? await stockPrefetch : null;
    photo = prefetched ?? (await stockPhoto(category, seed, colors));
  }

  // 13. Offre & promo (métier × type de carte) ────────────────────────────
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

  // 14. Suggestions douces ────────────────────────────────────────────────
  const suggestions: EssaiSuggestion[] = [];
  if (logo.kind === "typographic") suggestions.push("add_logo");
  if (photo.source === "stock") suggestions.push("add_photo");
  if (source === "instagram" && !screenshot && !autoImage && logo.kind !== "real") suggestions.push("add_screenshot");

  const websiteUrl = maps?.website ?? website?.finalUrl ?? (source === "website" ? url : null) ?? null;

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
    reviewUrl: maps?.reviewUrl ?? null,
    address: maps?.address ?? website?.address ?? null,
    location: maps?.location ?? website?.location ?? null,
    website: websiteUrl,
    aiUsed: ai !== null,
    cardType,
    photo,
    firstName,
    suggestions,
  };

  console.info(
    `[essai/brand] source=${source} métier=${category} type=${cardType} logo=${logo.kind} photo=${photo.source} ia=${ai ? "oui" : "non"}${siteUnreadable ? " site=illisible" : ""} durée=${Date.now() - startedAt}ms`,
  );
  return profile;
}
