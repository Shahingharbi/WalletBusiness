import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN, MAX_STAMPS, MIN_STAMPS } from "@/lib/constants";
import { isStampIconKey, type StampIconKey } from "@/lib/stamp-icons";
import { getEssaiBusinessId } from "@/lib/essai/business";
import { essaiCardType, generateEssaiEditKey, hashEssaiEditKey } from "@/lib/essai/load";
import {
  ESSAI_CATEGORIES,
  type BrandColors,
  type BrandPhoto,
  type BrandProfile,
  type EssaiCardType,
  type EssaiCategory,
  type EssaiMeta,
  type EssaiSource,
  type EssaiSuggestion,
  type StampShape,
} from "@/lib/essai/types";

/**
 * Création de la VRAIE carte de démo à partir du profil de marque analysé :
 *
 *   1. logo PNG + photo de bande JPEG → bucket public `card-assets`
 *      (essai/<cardId>/logo-<ts>.png, essai/<cardId>/photo-<ts>.jpg).
 *      Apple et Google récupèrent les images par URL (Google exige du https
 *      public), d'où l'upload AVANT l'insert de la carte ;
 *   2. ligne `cards` dans le commerce essai, du type choisi (tampons, points,
 *      remise, VIP), design = défauts + marque + photo (`banner_url`) +
 *      `design.essai` = EssaiMeta ;
 *   3. ligne `clients` avec le prénom saisi (« Bonjour <prénom> ») ;
 *   4. ligne `card_instances` avec déjà 2 tampons (types à compteur), pour que
 *      la grille montre tout de suite la progression. Son `token` (default DB)
 *      est relu : c'est la clé de /essai/<token> et le serial du pass Apple.
 *
 * Le token n'est PAS un secret (il est dans le pass, le lien partagé…) : les
 * retouches exigent en plus une clé d'édition aléatoire, renvoyée ici au
 * créateur (cookie httpOnly posé par POST /api/essai) et dont seule
 * l'empreinte SHA-256 est stockée (`design.essai.edit_key_hash`).
 *
 * Si une étape échoue, tout ce qui a déjà été créé est supprimé : jamais de
 * carte orpheline ni d'image abandonnée dans le bucket.
 */

export const ESSAI_ASSETS_BUCKET = "card-assets";
/** Tampons déjà présents sur la carte de démo (grille « vivante »). */
export const ESSAI_INITIAL_STAMPS = 2;

const HEX_RE = /^#[0-9a-f]{6}$/i;
const SHAPES: readonly StampShape[] = ["circle", "squircle", "shield", "star", "hex"];
const SOURCES: readonly EssaiSource[] = ["website", "maps", "instagram", "photo", "name"];
const SUGGESTIONS: readonly EssaiSuggestion[] = ["add_logo", "add_photo", "add_screenshot"];
const PHOTO_SOURCES: readonly BrandPhoto["source"][] = [
  "upload",
  "screenshot",
  "website",
  "places",
  "instagram",
  "stock",
];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Limites alignées sur l'éditeur de carte et les slots wallet.
export const ESSAI_NAME_MAX = 40;
export const ESSAI_REWARD_MAX = 60;
export const ESSAI_FIRST_NAME_MAX = 30;
/** « Nom — adresse » de la fiche Google liée aux avis. */
export const ESSAI_REVIEW_LABEL_MAX = 160;
const LABEL_MAX = 14;
const PROMO_MAX = 120;

/** Libellé du compteur par défaut, selon le type. */
const DEFAULT_LABELS: Record<EssaiCardType, string> = {
  stamp: "Tampons",
  cashback: "Points",
  discount: "Avantage",
  membership: "Statut",
};

/** Offre de repli (le module brand en fournit toujours une, en principe). */
const DEFAULT_REWARDS: Record<EssaiCardType, string> = {
  stamp: "10 passages = 1 cadeau offert",
  cashback: "10 points = 1 cadeau offert",
  discount: "-10 % sur tout, toute l'année",
  membership: "Avantages réservés aux membres",
};

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // Espaces normalisés SAUF les insécables (« −10 % », « 5 € ») posés par
  // le module brand pour la typographie française.
  return value.replace(/[^\S  ]+/g, " ").trim().slice(0, max).trim();
}

/** Type de carte avec compteur « X / Y » (tampons, points). */
export function isCounterCardType(type: EssaiCardType): boolean {
  return type === "stamp" || type === "cashback";
}

function hexOr(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_RE.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

function httpsUrlOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function httpUrlOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Le profil vient de l'analyse de marque (autre module, entrées externes) :
 * on revalide chaque champ contre les contraintes DB / wallet plutôt que de
 * lui faire une confiance aveugle.
 */
function normalizeProfile(profile: BrandProfile) {
  const name = cleanText(profile.name, ESSAI_NAME_MAX) || "Mon commerce";
  const cardType = essaiCardType(profile.cardType);
  const stampCount = Math.min(
    MAX_STAMPS,
    Math.max(MIN_STAMPS, Math.round(Number(profile.stampCount) || 10))
  );
  const stampIcon: StampIconKey = isStampIconKey(profile.stampIcon)
    ? profile.stampIcon
    : "star";
  const stampShape: StampShape = SHAPES.includes(profile.stampShape)
    ? profile.stampShape
    : "circle";

  const category: EssaiCategory = (ESSAI_CATEGORIES as readonly string[]).includes(
    profile.category
  )
    ? profile.category
    : "autre";
  const source: EssaiSource = SOURCES.includes(profile.source) ? profile.source : "website";

  return {
    name,
    category,
    source,
    cardType,
    firstName: cleanText(profile.firstName, ESSAI_FIRST_NAME_MAX) || null,
    colors: {
      background: hexOr(profile.colors?.background, "#141414"),
      text: hexOr(profile.colors?.text, "#ffffff"),
      accent: hexOr(profile.colors?.accent, "#fbbf24"),
    },
    stampCount,
    stampIcon,
    stampShape,
    rewardText: cleanText(profile.rewardText, ESSAI_REWARD_MAX) || DEFAULT_REWARDS[cardType],
    labelStamps: cleanText(profile.labelStamps, LABEL_MAX) || DEFAULT_LABELS[cardType],
    promoMessage:
      cleanText(profile.promoMessage, PROMO_MAX) ||
      `🔥 ${name} : une offre spéciale vous attend aujourd'hui !`,
    palette: (profile.palette ?? []).filter((c) => HEX_RE.test(c)).slice(0, 8),
    reviewUrl: httpsUrlOrNull(profile.reviewUrl),
    reviewLabel: cleanText(profile.reviewLabel, ESSAI_REVIEW_LABEL_MAX) || null,
    sourceUrl: httpUrlOrNull(profile.sourceUrl),
    website: httpUrlOrNull(profile.website),
    address: cleanText(profile.address, 200) || null,
    location:
      profile.location &&
      Number.isFinite(profile.location.lat) &&
      Number.isFinite(profile.location.lng)
        ? { lat: profile.location.lat, lng: profile.location.lng }
        : null,
    suggestions: SUGGESTIONS.filter((s) => (profile.suggestions ?? []).includes(s)),
    photoSource: PHOTO_SOURCES.includes(profile.photo?.source)
      ? profile.photo.source
      : ("stock" as const),
  };
}

/** Garantit un PNG (le wallet et le PDF de l'affiche n'acceptent pas tout). */
export async function ensurePng(buffer: Buffer): Promise<Buffer> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("[essai] logo vide");
  }
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return buffer;
  return sharp(buffer, { failOn: "none" }).png().toBuffer();
}

/**
 * Garantit un JPEG raisonnable pour la bande (la route bannière le
 * retélécharge à chaque rendu : on évite les fichiers géants).
 */
export async function ensureJpeg(buffer: Buffer): Promise<Buffer> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("[essai] photo vide");
  }
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg && buffer.length <= 1_500_000) return buffer;
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

/**
 * Filet de sécurité si l'analyse n'a fourni AUCUNE photo (ne devrait pas
 * arriver : le module brand renvoie au pire une photo du métier) : dégradé
 * aux couleurs de la marque, pour que la bande ne soit jamais vide.
 */
async function fallbackBandPhoto(colors: BrandColors): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="525">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.accent}"/>
      <stop offset="1" stop-color="${colors.background}"/>
    </linearGradient></defs>
    <rect width="1600" height="525" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

/** Upload d'une image de carte d'essai (chemin horodaté donc immuable). */
export async function uploadEssaiAsset(
  admin: SupabaseClient,
  path: string,
  body: Buffer,
  contentType: "image/png" | "image/jpeg"
): Promise<string> {
  const { error } = await admin.storage.from(ESSAI_ASSETS_BUCKET).upload(path, body, {
    contentType,
    // Chemin horodaté donc immuable : cache long côté CDN / wallets.
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`[essai] upload ${path} : ${error.message}`);
  const {
    data: { publicUrl },
  } = admin.storage.from(ESSAI_ASSETS_BUCKET).getPublicUrl(path);
  return publicUrl;
}

export interface CreatedEssaiCard {
  cardId: string;
  token: string;
  logoUrl: string;
  photoUrl: string;
  name: string;
  colors: BrandColors;
  cardType: EssaiCardType;
  suggestions: EssaiSuggestion[];
  /**
   * Clé d'édition EN CLAIR, à remettre uniquement au créateur (cookie
   * httpOnly). Jamais stockée telle quelle ni renvoyée dans un corps JSON.
   */
  editKey: string;
}

/**
 * Crée la carte de démo. Renvoie aussi le nom, les couleurs, le type et les
 * images EFFECTIVEMENT enregistrés (après validation), pour que la réponse
 * HTTP reflète la carte.
 */
export async function createEssaiCard(profile: BrandProfile): Promise<CreatedEssaiCard> {
  const admin = createAdminClient();
  const businessId = await getEssaiBusinessId(admin);
  const p = normalizeProfile(profile);

  // L'id de la carte est généré ici pour ranger les images sous
  // essai/<cardId>/ AVANT l'insert (la carte est créée d'un coup avec elles).
  const cardId = randomUUID();
  const editKey = generateEssaiEditKey();
  const ts = Date.now();
  const logoPath = `essai/${cardId}/logo-${ts}.png`;
  const photoPath = `essai/${cardId}/photo-${ts}.jpg`;

  // Annulations à jouer en ordre inverse si une étape échoue.
  const undo: { label: string; run: () => PromiseLike<{ error: unknown }> }[] = [];

  try {
    const hasPhoto = Buffer.isBuffer(profile.photo?.jpeg) && profile.photo.jpeg.length > 0;
    if (!hasPhoto) {
      console.error("[essai/create] profil sans photo : dégradé de secours");
      if (!p.suggestions.includes("add_photo")) p.suggestions.push("add_photo");
    }
    const [png, jpeg] = await Promise.all([
      ensurePng(profile.logo?.png),
      hasPhoto ? ensureJpeg(profile.photo.jpeg) : fallbackBandPhoto(p.colors),
    ]);
    const [logoUrl, photoUrl] = await Promise.all([
      uploadEssaiAsset(admin, logoPath, png, "image/png"),
      uploadEssaiAsset(admin, photoPath, jpeg, "image/jpeg"),
    ]).catch(async (err) => {
      // Un des deux uploads a pu réussir : on nettoie les deux chemins.
      await admin.storage.from(ESSAI_ASSETS_BUCKET).remove([logoPath, photoPath]);
      throw err;
    });
    undo.push({
      label: "images",
      run: () => admin.storage.from(ESSAI_ASSETS_BUCKET).remove([logoPath, photoPath]),
    });

    const meta: EssaiMeta = {
      v: 1,
      source: p.source,
      source_url: p.sourceUrl,
      category: p.category,
      palette: p.palette,
      logo_kind: profile.logo?.kind === "real" ? "real" : "typographic",
      review_url: p.reviewUrl,
      // Fiche liée (« Nom — adresse ») : sans lien d'avis, elle ne veut rien dire.
      review_label: p.reviewUrl ? p.reviewLabel : null,
      promo_message: p.promoMessage,
      address: p.address,
      location: p.location,
      website: p.website,
      ai_used: profile.aiUsed === true,
      suggestions: p.suggestions,
      card_type: p.cardType,
      photo_source: p.photoSource,
      first_name: p.firstName,
      design_version: 1,
      created_at: new Date().toISOString(),
      actions: { stamp: 0, promo: 0, review: 0 },
      claimed: null,
      edit_key_hash: hashEssaiEditKey(editKey),
    };

    const design = {
      ...DEFAULT_CARD_DESIGN,
      background_color: p.colors.background,
      text_color: p.colors.text,
      accent_color: p.colors.accent,
      logo_url: logoUrl,
      // Photo plein cadre de la bande, sous la grille de tampons.
      banner_url: photoUrl,
      stamp_icon: p.stampIcon,
      stamp_shape: p.stampShape,
      label_stamps: p.labelStamps,
      welcome_reward: "",
      essai: meta,
    };

    const { error: cardErr } = await admin.from("cards").insert({
      id: cardId,
      business_id: businessId,
      name: p.name,
      card_type: p.cardType,
      status: "active",
      barcode_type: "qr",
      stamp_count: p.stampCount,
      reward_text: p.rewardText,
      expiration_type: "unlimited",
      // Le commerce porteur s'appelle « Essai aswallet » : c'est ce champ
      // qui fait afficher le VRAI nom du commerce en haut du pass.
      wallet_business_name: p.name,
      design,
    });
    if (cardErr) throw new Error(`[essai/create] insert carte : ${cardErr.message}`);
    // La suppression de la carte supprime aussi l'instance (ON DELETE CASCADE).
    undo.push({
      label: "carte",
      run: () => admin.from("cards").delete().eq("id", cardId),
    });

    const { data: client, error: clientErr } = await admin
      .from("clients")
      .insert({ business_id: businessId, first_name: p.firstName })
      .select("id")
      .single();
    if (clientErr || !client) {
      throw new Error(`[essai/create] insert client : ${clientErr?.message ?? "sans retour"}`);
    }
    const clientId = client.id as string;
    undo.push({
      label: "client",
      run: () => admin.from("clients").delete().eq("id", clientId),
    });

    const initialStamps = isCounterCardType(p.cardType)
      ? Math.max(0, Math.min(ESSAI_INITIAL_STAMPS, p.stampCount - 1))
      : 0;
    const { data: instance, error: instanceErr } = await admin
      .from("card_instances")
      .insert({
        card_id: cardId,
        client_id: clientId,
        business_id: businessId,
        status: "active",
        stamps_collected: initialStamps,
        total_stamps_ever: initialStamps,
      })
      .select("token")
      .single();
    if (instanceErr || !instance?.token) {
      throw new Error(
        `[essai/create] insert carte client : ${instanceErr?.message ?? "token absent"}`
      );
    }

    return {
      cardId,
      token: instance.token as string,
      logoUrl,
      photoUrl,
      name: p.name,
      colors: p.colors,
      cardType: p.cardType,
      suggestions: p.suggestions,
      editKey,
    };
  } catch (err) {
    for (const step of undo.reverse()) {
      try {
        const { error } = await step.run();
        if (error) console.error(`[essai/create] nettoyage ${step.label} échoué :`, error);
      } catch (cleanupErr) {
        console.error(`[essai/create] nettoyage ${step.label} échoué :`, cleanupErr);
      }
    }
    throw err;
  }
}
