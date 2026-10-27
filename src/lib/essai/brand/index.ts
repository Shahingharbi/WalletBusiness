/**
 * Orchestrateur « votre carte en 30 secondes » : un lien (site, Google Maps,
 * Instagram) et/ou une photo → profil de marque complet (nom, métier,
 * couleurs exactes, logo, récompense, promo, lien d'avis…).
 *
 * Principe : chaque signal est un BONUS. Un site lent, une fiche Maps sans
 * API, une IA absente ou une photo floue dégradent le résultat (warnings en
 * français), jamais la création de la carte. On ne lève une erreur que si
 * l'on n'a littéralement rien d'exploitable (lien invalide / refusé ET pas de
 * photo, ou photo illisible sans lien).
 *
 * Server-only.
 */

import sharp from "sharp";
import type {
  AiBrandResult,
  BrandInput,
  BrandProfile,
  EssaiCategory,
  EssaiSource,
  MapsSignals,
  PaletteColor,
  WebsiteSignals,
} from "../types";
import { analyzeBrandWithAI, isAiConfigured } from "./ai";
import {
  CATEGORY_PRESETS,
  clampName,
  detectCategory,
  nameFromDomain,
  normalizeForMatch,
  promoMessageFor,
} from "./category";
import { chooseBrandColors, deltaE, extractPalette } from "./colors";
import { INSTAGRAM_SCREENSHOT_WARNING, isInstagramUrl, parseInstagram } from "./instagram";
import { logoFromImageWithSource, prepareLogoWithSource, typographicLogo, type PreparedLogo } from "./logo";
import { extractMapsSignals, isGoogleMapsUrl } from "./maps";
import { normalizeUserUrl, SafeFetchError } from "./safe-fetch";
import { extractWebsiteSignals } from "./website";

/** Budget de collecte des signaux réseau (site, fiche Maps). */
const SIGNALS_BUDGET_MS = 20_000;
/** Temps minimal laissé aux logos, même si la collecte a consommé son budget. */
const LOGO_MIN_MS = 8_000;
/** Plafond IA (le SDK a son propre délai de 20 s + 1 nouvelle tentative). */
const AI_MAX_MS = 22_000;
/** Fin de l'analyse au plus tard (la route a `maxDuration = 60`). */
const TOTAL_BUDGET_MS = 48_000;
const FALLBACK_NAME = "Mon commerce";
/** Palette « fine » proposée à l'IA pour une image entière (voir colors.ts). */
const AI_PALETTE_OPTIONS = { sampleSide: 256, minRatio: 0.003, maxColors: 12 } as const;
const NBSP = "\u00A0";

/**
 * Erreur « affichable » : `message` est en français, prêt pour l'utilisateur.
 * `status` suggère le code HTTP à renvoyer (422 : entrée inexploitable).
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

/** Noms génériques à ne jamais afficher comme nom de commerce. */
const GENERIC_NAMES = new Set([
  "accueil", "home", "homepage", "bienvenue", "welcome", "site officiel", "official site",
  "page d accueil", "index", "mon site", "site web", "website", "untitled", "sans titre",
]);

/** Nom propre (≤ 40 car., sans guillemets ni libellé générique) ou null. */
function cleanName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'«“”»\s]+|["'«“”»\s]+$/g, "")
    .trim();
  if (!s || GENERIC_NAMES.has(normalizeForMatch(s))) return null;
  return clampName(s, 40) || null;
}

/** Fichier de capture d'écran de téléphone (portrait très allongé). */
function isScreenshotShaped(width: number, height: number): boolean {
  return width >= 540 && height / width >= 1.6;
}

/**
 * La récompense proposée par l'IA doit coller à la grille de tampons :
 * tout nombre qui n'est ni un pourcentage ni un montant doit valoir 1, le
 * nombre de tampons, ou le suivant (« 9 cafés achetés = le 10e offert »).
 */
function rewardFitsStampCount(text: string, stampCount: number): boolean {
  const allowed = new Set([1, stampCount, stampCount + 1]);
  const re = /(\d+)(?=(\s*)(%|€)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[3]) continue; // −20 %, 5 €
    if (!allowed.has(Number(m[1]))) return false;
  }
  return true;
}

function hostnameOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Erreur réseau → message français affichable (celui de safe-fetch si dispo). */
function fetchErrorMessage(err: unknown): string {
  if (err instanceof SafeFetchError) return err.message;
  return "Le site n'a pas pu être lu pour le moment.";
}

/** Lien refusé d'emblée (syntaxe, hôte interne, réseau social) : rien à espérer. */
function isFatalUrlError(err: unknown): boolean {
  return err instanceof SafeFetchError && (err.code === "invalid_url" || err.code === "blocked_host");
}

/**
 * Ramène les couleurs choisies par l'IA sur la palette finale (mesurée sur
 * le logo retenu) : l'IA a pu voir une palette plus large (image entière).
 * Palette finale vide → on garde ses choix (eux aussi mesurés sur l'image).
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

// ─── Orchestrateur ────────────────────────────────────────────────────────

export async function analyzeBrand(input: BrandInput): Promise<BrandProfile> {
  const startedAt = Date.now();
  const signalsDeadline = startedAt + SIGNALS_BUDGET_MS;
  const hardDeadline = startedAt + TOTAL_BUDGET_MS;
  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (!warnings.includes(msg)) warnings.push(msg);
  };

  const userName = cleanName(input.name);
  const image = input.image?.buffer && input.image.buffer.length > 0 ? input.image : null;
  const rawUrl = (input.url ?? "").trim();

  // 1. Source ──────────────────────────────────────────────────────────────
  let url: string | null = null;
  if (rawUrl) {
    url = normalizeUserUrl(rawUrl);
    if (!url) {
      if (!image) {
        throw new BrandAnalysisError(
          "Ce lien n'est pas valide. Vérifiez-le, ou prenez une photo de votre enseigne.",
        );
      }
      warn(`Le lien n'est pas valide${NBSP}: la carte a été créée à partir de votre photo.`);
    }
  }

  let source: EssaiSource;
  if (url && isInstagramUrl(url)) source = "instagram";
  else if (url && isGoogleMapsUrl(url)) source = "maps";
  else if (url) source = "website";
  else if (image) source = "photo";
  else {
    throw new BrandAnalysisError(
      "Collez le lien de votre commerce ou prenez une photo de votre enseigne.",
    );
  }

  // 2. Image fournie : lecture, palette et « est-ce un logo ? » en tâche de fond
  //    (en parallèle des appels réseau).
  let imageMeta: { width: number; height: number } | null = null;
  if (image) {
    try {
      const meta = await sharp(image.buffer, { failOn: "none" }).metadata();
      const swap = (meta.orientation ?? 1) >= 5; // EXIF : photo tournée de 90°
      if (meta.width && meta.height) {
        imageMeta = swap
          ? { width: meta.height, height: meta.width }
          : { width: meta.width, height: meta.height };
      }
    } catch {
      imageMeta = null;
    }
    if (!imageMeta) {
      if (!url) {
        throw new BrandAnalysisError(
          "Votre photo n'a pas pu être lue. Essayez avec une autre image (JPG ou PNG).",
        );
      }
      warn(`Votre photo n'a pas pu être lue${NBSP}: elle a été ignorée.`);
    }
  }
  const usableImage = image && imageMeta ? image : null;
  const screenshot = imageMeta ? isScreenshotShaped(imageMeta.width, imageMeta.height) : false;
  const imagePalettePromise = usableImage ? extractPalette(usableImage.buffer) : Promise.resolve([]);
  const imageLogoPromise = usableImage
    ? logoFromImageWithSource(usableImage.buffer)
    : Promise.resolve<PreparedLogo | null>(null);

  // 3. Signaux réseau ──────────────────────────────────────────────────────
  let website: WebsiteSignals | null = null;
  let maps: MapsSignals | null = null;
  let instagram: { handle: string; nameGuess: string } | null = null;
  const remaining = () => Math.max(1_500, signalsDeadline - Date.now());

  if (source === "instagram" && url) {
    instagram = parseInstagram(url);
    if (!usableImage) warn(INSTAGRAM_SCREENSHOT_WARNING);
    if (!instagram) {
      warn(
        "Ce lien Instagram ne contient pas de nom de profil. Collez plutôt le lien du profil (instagram.com/votre-commerce).",
      );
    }
  } else if (source === "maps" && url) {
    const res = await settle(extractMapsSignals(url), remaining());
    if (res.ok) {
      maps = res.value;
    } else {
      if (!usableImage && isFatalUrlError(res.error)) {
        throw new BrandAnalysisError(fetchErrorMessage(res.error));
      }
      warn("Nous n'avons pas pu lire la fiche Google Maps. Vérifiez le lien ou ajoutez une photo.");
    }
    // Le site du commerce (connu grâce à la fiche) apporte logo et couleurs.
    if (maps?.website) {
      const res2 = await settle(extractWebsiteSignals(maps.website), remaining());
      if (res2.ok) website = res2.value;
    }
  } else if (source === "website" && url) {
    const res = await settle(extractWebsiteSignals(url), remaining());
    if (res.ok) {
      website = res.value;
    } else {
      if (!usableImage && isFatalUrlError(res.error)) {
        throw new BrandAnalysisError(fetchErrorMessage(res.error));
      }
      warn(`${fetchErrorMessage(res.error)} La carte a été créée avec les informations disponibles.`);
    }
  }

  // 4. Logo du site (candidats déjà triés par confiance par website.ts).
  const webLogoPromise: Promise<PreparedLogo | null> = website?.logoCandidates.length
    ? settle(
        prepareLogoWithSource(website.logoCandidates),
        Math.max(LOGO_MIN_MS, signalsDeadline - Date.now()),
      ).then((r) => (r.ok ? r.value : null))
    : Promise.resolve(null);

  const [imagePalette, imageLogo, webLogo] = await Promise.all([
    imagePalettePromise,
    imageLogoPromise,
    webLogoPromise,
  ]);

  // 5. Métier (heuristique) et nom des signaux ─────────────────────────────
  const hostName = nameFromDomain(hostnameOf(website?.finalUrl ?? (source === "website" ? url : null)));
  const signalName =
    cleanName(maps?.name) ?? cleanName(website?.name) ?? cleanName(instagram?.nameGuess) ?? null;
  const categoryTexts = [
    userName ?? signalName ?? hostName,
    website?.description ?? "",
    website?.textSample ?? "",
    instagram?.handle ?? "",
  ];
  const categoryTypes = [...(maps?.types ?? []), ...(website?.jsonLdTypes ?? [])];
  const heuristicCategory = detectCategory({ texts: categoryTexts, types: categoryTypes });

  // 6. IA (si configurée) ──────────────────────────────────────────────────
  //    photo / Instagram : toujours (nom exact, métier, zone du logo) ;
  //    site / Maps : seulement si le nom ou le métier restent incertains.
  const nameUncertain = !userName && (!signalName || (!!hostName && signalName === hostName));
  const wantAi =
    isAiConfigured() &&
    (source === "photo" ||
      source === "instagram" ||
      nameUncertain ||
      heuristicCategory === "autre");

  let ai: AiBrandResult | null = null;
  let aiSawUserImage = false;
  if (wantAi) {
    // Image envoyée à l'IA : celle de l'utilisateur, sinon le logo du site
    // (pour lire le nom inscrit dessus).
    const aiImage = usableImage
      ? usableImage
      : webLogo
        ? { buffer: webLogo.source, mimeType: "image/png" }
        : null;
    aiSawUserImage = !!usableImage;
    // Sur une photo / capture, le logo ne couvre que quelques % des pixels :
    // palette plus fine pour que ses couleurs figurent parmi les choix.
    const aiPalette = usableImage
      ? await extractPalette(usableImage.buffer, AI_PALETTE_OPTIONS)
      : webLogo
        ? await extractPalette(webLogo.source)
        : [];
    const budget = Math.min(AI_MAX_MS, hardDeadline - Date.now());
    if (budget > 3_000) {
      const res = await settle(
        analyzeBrandWithAI({
          image: aiImage,
          name: userName ?? signalName,
          texts: [
            signalName ?? "",
            instagram ? `Pseudo Instagram : @${instagram.handle}` : "",
            website?.description ?? "",
            maps?.address ? `Adresse : ${maps.address}` : "",
            website?.textSample ?? "",
          ],
          palette: aiPalette.map((c) => c.hex),
          source,
        }),
        budget,
      );
      ai = res.ok ? res.value : null;
    }
  }

  // 7. Logo retenu ─────────────────────────────────────────────────────────
  //    a) l'image envoyée si c'est un logo (l'IA tranche ; sans IA, on se
  //       méfie des captures d'écran : une page blanche a « peu de couleurs ») ;
  //    b) le logo du site / de la fiche ;
  //    c) la zone du logo repérée par l'IA dans la photo / la capture.
  let chosen: PreparedLogo | null = null;
  if (usableImage) {
    const imageIsLogo = ai && aiSawUserImage ? ai.imageIsLogo : imageLogo !== null && !screenshot;
    if (imageIsLogo) {
      chosen =
        imageLogo ??
        (await logoFromImageWithSource(usableImage.buffer, { x: 0, y: 0, w: 1, h: 1 }));
    }
  }
  if (!chosen && webLogo) chosen = webLogo;
  if (!chosen && usableImage && ai && aiSawUserImage && ai.logoBox) {
    chosen = await logoFromImageWithSource(usableImage.buffer, ai.logoBox);
  }

  // 8. Palette mesurée : sur le logo retenu, sinon sur la photo (sauf capture
  //    d'écran sans IA : on y mesurerait l'interface d'Instagram, pas la marque).
  let palette: PaletteColor[] = [];
  if (chosen) palette = await extractPalette(chosen.source);
  else if (usableImage && !(screenshot && !ai)) palette = imagePalette;

  // 9. Métier final, nom, préréglage ───────────────────────────────────────
  let category: EssaiCategory = heuristicCategory;
  if (ai && ai.category !== "autre") {
    // Photo / Instagram : l'IA voit mieux que nos mots-clés. Site / Maps :
    // les types structurés (JSON-LD, Places) restent prioritaires.
    if (source === "photo" || source === "instagram" || heuristicCategory === "autre") {
      category = ai.category;
    }
  }

  const name =
    userName ??
    (maps?.placesApiUsed ? cleanName(maps.name) : null) ??
    cleanName(ai?.businessName) ??
    signalName ??
    cleanName(hostName) ??
    FALLBACK_NAME;
  if (name === FALLBACK_NAME) {
    warn("Nous n'avons pas trouvé le nom de votre commerce. Indiquez-le pour personnaliser la carte.");
  }

  const preset = CATEGORY_PRESETS[category] ?? CATEGORY_PRESETS.autre;

  // 10. Couleurs ───────────────────────────────────────────────────────────
  const preferred = ai ? snapToPalette([ai.primaryColor, ai.secondaryColor], palette) : [];
  const colors = chooseBrandColors({
    palette,
    themeColor: website?.themeColor ?? null,
    manifestColors: website?.manifestColors ?? [],
    preferred,
  });

  // 11. Logo final (vrai logo, sinon initiales) ────────────────────────────
  const logo = chosen?.logo ?? (await typographicLogo(name, colors));
  if (!chosen) {
    warn(
      usableImage
        ? `Votre logo n'a pas pu être isolé sur la photo${NBSP}: nous avons créé un logo avec vos initiales.`
        : `Logo introuvable${NBSP}: nous avons créé un logo avec vos initiales.`,
    );
  }

  // 12. Textes de la carte ─────────────────────────────────────────────────
  const aiReward = ai?.rewardText?.trim() ?? "";
  const rewardText =
    aiReward && aiReward.length <= 60 && rewardFitsStampCount(aiReward, preset.stampCount)
      ? aiReward
      : preset.rewardText;

  const aiPromo = ai?.promoMessage?.trim() ?? "";
  const promoMessage =
    aiPromo && aiPromo.length <= 120 && normalizeForMatch(aiPromo).includes(normalizeForMatch(name))
      ? aiPromo
      : promoMessageFor(category, name);

  const websiteUrl =
    maps?.website ?? website?.finalUrl ?? (source === "website" ? url : null) ?? null;

  const profile: BrandProfile = {
    source,
    sourceUrl: url,
    name,
    category,
    colors,
    palette: palette.map((c) => c.hex),
    logo,
    rewardText,
    stampCount: preset.stampCount,
    stampIcon: preset.stampIcon,
    stampShape: preset.stampShape,
    labelStamps: preset.labelStamps,
    promoMessage,
    reviewUrl: maps?.reviewUrl ?? null,
    address: maps?.address ?? website?.address ?? null,
    location: maps?.location ?? website?.location ?? null,
    website: websiteUrl,
    aiUsed: ai !== null,
    warnings,
  };

  console.info(
    `[essai/brand] source=${source} métier=${category} logo=${logo.kind} ia=${ai ? "oui" : "non"} durée=${Date.now() - startedAt}ms`,
  );
  return profile;
}
