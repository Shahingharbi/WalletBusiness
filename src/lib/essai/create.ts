import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN, MAX_STAMPS, MIN_STAMPS } from "@/lib/constants";
import { isStampIconKey, type StampIconKey } from "@/lib/stamp-icons";
import { getEssaiBusinessId } from "@/lib/essai/business";
import {
  ESSAI_CATEGORIES,
  type BrandColors,
  type BrandProfile,
  type EssaiCategory,
  type EssaiMeta,
  type EssaiSource,
  type StampShape,
} from "@/lib/essai/types";

/**
 * Création de la VRAIE carte de démo à partir du profil de marque analysé :
 *
 *   1. logo PNG → bucket public `card-assets` (essai/<cardId>/logo-<ts>.png).
 *      Apple et Google récupèrent le logo par URL (Google exige du https
 *      public), d'où l'upload AVANT l'insert de la carte ;
 *   2. ligne `cards` dans le commerce essai (design = défauts + marque +
 *      `design.essai` = EssaiMeta) ;
 *   3. ligne `clients` anonyme (le prospect n'a rien saisi) ;
 *   4. ligne `card_instances` avec déjà 2 tampons, pour que la grille montre
 *      tout de suite la progression. Son `token` (default DB) est relu : c'est
 *      la clé de /essai/<token> et le serial du pass Apple.
 *
 * Si une étape échoue, tout ce qui a déjà été créé est supprimé : jamais de
 * carte orpheline ni de logo abandonné dans le bucket.
 */

const LOGO_BUCKET = "card-assets";
/** Tampons déjà présents sur la carte de démo (grille « vivante »). */
const INITIAL_STAMPS = 2;

const HEX_RE = /^#[0-9a-f]{6}$/i;
const SHAPES: readonly StampShape[] = ["circle", "squircle", "shield", "star", "hex"];
const SOURCES: readonly EssaiSource[] = ["website", "maps", "instagram", "photo", "name"];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Limites alignées sur l'éditeur de carte et les slots wallet.
const NAME_MAX = 40;
const REWARD_MAX = 60;
const LABEL_MAX = 14;
const PROMO_MAX = 120;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
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
  const name = cleanText(profile.name, NAME_MAX) || "Mon commerce";
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
    colors: {
      background: hexOr(profile.colors?.background, "#141414"),
      text: hexOr(profile.colors?.text, "#ffffff"),
      accent: hexOr(profile.colors?.accent, "#fbbf24"),
    },
    stampCount,
    stampIcon,
    stampShape,
    rewardText:
      cleanText(profile.rewardText, REWARD_MAX) || "10 passages = 1 cadeau offert",
    labelStamps: cleanText(profile.labelStamps, LABEL_MAX) || "Tampons",
    promoMessage:
      cleanText(profile.promoMessage, PROMO_MAX) ||
      `🔥 ${name} : une offre spéciale vous attend aujourd'hui !`,
    palette: (profile.palette ?? []).filter((c) => HEX_RE.test(c)).slice(0, 8),
    reviewUrl: httpsUrlOrNull(profile.reviewUrl),
    sourceUrl: httpUrlOrNull(profile.sourceUrl),
    website: httpUrlOrNull(profile.website),
    address: cleanText(profile.address, 200) || null,
    location:
      profile.location &&
      Number.isFinite(profile.location.lat) &&
      Number.isFinite(profile.location.lng)
        ? { lat: profile.location.lat, lng: profile.location.lng }
        : null,
    warnings: (profile.warnings ?? [])
      .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      .slice(0, 10),
  };
}

/** Garantit un PNG (le wallet et le PDF de l'affiche n'acceptent pas tout). */
async function ensurePng(buffer: Buffer): Promise<Buffer> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("[essai/create] logo vide");
  }
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return buffer;
  return sharp(buffer, { failOn: "none" }).png().toBuffer();
}

/**
 * Crée la carte de démo. Renvoie aussi le nom et les couleurs EFFECTIVEMENT
 * enregistrés (après validation), pour que la réponse HTTP reflète la carte.
 */
export async function createEssaiCard(profile: BrandProfile): Promise<{
  cardId: string;
  token: string;
  logoUrl: string;
  name: string;
  colors: BrandColors;
}> {
  const admin = createAdminClient();
  const businessId = await getEssaiBusinessId(admin);
  const p = normalizeProfile(profile);

  // L'id de la carte est généré ici pour ranger le logo sous essai/<cardId>/
  // AVANT l'insert (la carte est ainsi créée d'un coup avec son logo).
  const cardId = randomUUID();
  const logoPath = `essai/${cardId}/logo-${Date.now()}.png`;

  // Annulations à jouer en ordre inverse si une étape échoue.
  const undo: { label: string; run: () => PromiseLike<{ error: unknown }> }[] = [];

  try {
    const png = await ensurePng(profile.logo?.png);
    const { error: uploadErr } = await admin.storage
      .from(LOGO_BUCKET)
      .upload(logoPath, png, {
        contentType: "image/png",
        // Chemin horodaté donc immuable : cache long côté CDN / wallets.
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadErr) throw new Error(`[essai/create] upload du logo : ${uploadErr.message}`);
    undo.push({
      label: "logo",
      run: () => admin.storage.from(LOGO_BUCKET).remove([logoPath]),
    });

    const {
      data: { publicUrl: logoUrl },
    } = admin.storage.from(LOGO_BUCKET).getPublicUrl(logoPath);

    const meta: EssaiMeta = {
      v: 1,
      source: p.source,
      source_url: p.sourceUrl,
      category: p.category,
      palette: p.palette,
      logo_kind: profile.logo?.kind === "real" ? "real" : "typographic",
      review_url: p.reviewUrl,
      promo_message: p.promoMessage,
      address: p.address,
      location: p.location,
      website: p.website,
      ai_used: profile.aiUsed === true,
      warnings: p.warnings,
      created_at: new Date().toISOString(),
      actions: { stamp: 0, promo: 0, review: 0 },
      claimed: null,
    };

    const design = {
      ...DEFAULT_CARD_DESIGN,
      background_color: p.colors.background,
      text_color: p.colors.text,
      accent_color: p.colors.accent,
      logo_url: logoUrl,
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
      card_type: "stamp",
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
      .insert({ business_id: businessId, first_name: null })
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

    const initialStamps = Math.min(INITIAL_STAMPS, p.stampCount - 1);
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
      name: p.name,
      colors: p.colors,
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
