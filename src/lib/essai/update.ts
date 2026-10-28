import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_STAMPS, MIN_STAMPS } from "@/lib/constants";
import { normalizeCardKind } from "@/lib/apple-wallet";
import { pushAppleWalletUpdate } from "@/lib/apple-wallet-push";
import {
  buildGoogleTextModules,
  isGoogleWalletConfigured,
  syncLoyaltyClass,
  syncLoyaltyObject,
  type PassParams,
} from "@/lib/google-wallet";
import { offerFor } from "@/lib/essai/brand/category";
import { initialsOf, logoFromUpload, typographicLogo } from "@/lib/essai/brand/logo";
import { photoFromUpload } from "@/lib/essai/brand/photo";
import {
  ESSAI_ASSETS_BUCKET,
  ESSAI_FIRST_NAME_MAX,
  ESSAI_INITIAL_STAMPS,
  ESSAI_NAME_MAX,
  ESSAI_REWARD_MAX,
  cleanText,
  ensureJpeg,
  ensurePng,
  isCounterCardType,
  uploadEssaiAsset,
} from "@/lib/essai/create";
import { EssaiError, ESSAI_NOT_FOUND_ERROR } from "@/lib/essai/errors";
import {
  ESSAI_TTL_DAYS,
  buildEssaiCardView,
  canEditEssai,
  essaiCardType,
  loadEssai,
  parseEssaiMeta,
  type LoadedEssai,
} from "@/lib/essai/load";
import {
  ESSAI_CARD_TYPES,
  type BrandColors,
  type EssaiCardType,
  type EssaiCardView,
  type EssaiMeta,
  type EssaiSuggestion,
  type EssaiUpdateRequest,
  type UploadedImage,
} from "@/lib/essai/types";

/**
 * Retouches en direct de la carte d'essai (page /essai/<token>) :
 *
 *  - PATCH  (updateEssaiCard)  : type, offre, prénom, nom, couleurs ;
 *  - média  (updateEssaiMedia) : nouveau logo ou nouvelle photo de bande.
 *
 * Chaque retouche :
 *   0. est réservée au créateur de la carte : la clé d'édition (cookie
 *      httpOnly `essai_k_<token>`, posé par POST /api/essai) doit correspondre
 *      à `design.essai.edit_key_hash` (403 sinon ; cartes v1 sans empreinte :
 *      libres). Le token seul ne suffit pas : il circule (pass, liens, QR) ;
 *   1. est refusée si la carte a été gardée (elle vit alors dans le compte du
 *      commerçant) ou si la démo a expiré ;
 *   2. est écrite par compare-and-swap sur `cards.updated_at` (jamais deux
 *      retouches qui s'écrasent, ni une retouche qui passe après un « garder ») ;
 *   3. incrémente `design_version` → nouvelle URL de bande (`?v=`) : Apple,
 *      Google et les CDN ne peuvent plus servir l'ancienne image ;
 *   4. touche la carte client (`card_instances.updated_at`) puis pousse la
 *      mise à jour aux wallets déjà installés (Google : classe + objet ;
 *      Apple : APNs → iOS refetch le pass), SANS notification visible ;
 *   5. logo typographique (initiales) : régénéré quand le nom ou les
 *      couleurs changent, dans la même écriture.
 */

// ─── Envoi d'images (multipart) — partagé avec POST /api/essai ───────────

/**
 * Garde technique silencieuse : Vercel coupe les corps > 4,5 Mo. Les images
 * arrivent déjà compressées par le navigateur, on ne l'atteint donc pas en
 * usage normal — aucune limite de poids n'est annoncée à l'utilisateur.
 */
export const ESSAI_MAX_REQUEST_BYTES = Math.floor(4.4 * 1024 * 1024);

/** Message neutre (aucun détail technique, aucune limite chiffrée). */
export const ESSAI_UPLOAD_ERROR =
  "Cette image n'a pas pu être envoyée, réessayez avec une autre photo.";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Type réel de l'image d'après ses premiers octets. Le type déclaré par le
 * navigateur n'est pas fiable (vide sur certains Android, mensonger si
 * l'appel est forgé) : on ne transmet à l'analyse que de vraies images.
 */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
  const ascii = (start: number, end: number) => buf.toString("latin1", start, end);
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) {
      return "image/heic";
    }
  }
  if (ascii(0, 2) === "BM") return "image/bmp";
  if (ascii(0, 4) === "II*\u0000" || ascii(0, 4) === "MM\u0000*") return "image/tiff";
  const head = buf.toString("utf8", 0, Math.min(buf.length, 1024)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "image/svg+xml";
  }
  return null;
}

/**
 * Lit un champ fichier d'un multipart. `null` si absent, vide ou si ce n'est
 * pas une image (ignoré en silence : l'interface proposera d'en ajouter une).
 */
export async function readImageFile(
  value: FormDataEntryValue | null | undefined
): Promise<UploadedImage | null> {
  if (!value || typeof value === "string" || value.size === 0) return null;
  const buffer = Buffer.from(await value.arrayBuffer());
  const sniffed = sniffImageType(buffer);
  const declared = (value.type || "").toLowerCase();
  if (!sniffed && !declared.startsWith("image/")) return null;
  return { buffer, mimeType: sniffed ?? declared };
}

// ─── Couleurs ────────────────────────────────────────────────────────────

const HEX6_RE = /^#?([0-9a-f]{6})$/i;
const HEX3_RE = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const DARK_TEXT = "#141414";
const LIGHT_TEXT = "#ffffff";
/** WCAG AA (texte normal) : les champs du pass sont petits. */
const MIN_TEXT_CONTRAST = 4.5;

/** « #abc », « abc », « #AABBCC » → « #aabbcc » ; `null` si invalide. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  const m6 = HEX6_RE.exec(v);
  if (m6) return `#${m6[1].toLowerCase()}`;
  const m3 = HEX3_RE.exec(v);
  if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`.toLowerCase();
  return null;
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Couleur de texte garantie lisible sur `background` : la couleur souhaitée
 * si son contraste suffit, sinon blanc ou quasi-noir (le plus contrasté).
 */
export function readableTextColor(background: string, preferred?: string | null): string {
  if (preferred && contrastRatio(preferred, background) >= MIN_TEXT_CONTRAST) return preferred;
  return contrastRatio(LIGHT_TEXT, background) >= contrastRatio(DARK_TEXT, background)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

// ─── Validation de la requête PATCH ──────────────────────────────────────

/** Corps JSON non typé → EssaiUpdateRequest validé (EssaiError 422 sinon). */
export function parseEssaiUpdateRequest(raw: unknown): EssaiUpdateRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EssaiError("Requête invalide.", 400);
  }
  const o = raw as Record<string, unknown>;
  const req: EssaiUpdateRequest = {};

  if (o.cardType !== undefined) {
    if (!(ESSAI_CARD_TYPES as readonly unknown[]).includes(o.cardType)) {
      throw new EssaiError("Choisissez un type de carte : Tampons, Points, Remise ou Carte VIP.", 422);
    }
    req.cardType = o.cardType as EssaiCardType;
  }

  if (o.rewardText !== undefined) {
    if (o.rewardText !== null && typeof o.rewardText !== "string") {
      throw new EssaiError("Écrivez votre offre en quelques mots.", 422);
    }
    // Chaîne vide = « réécrivez-la pour moi », comme null.
    req.rewardText = cleanText(o.rewardText, ESSAI_REWARD_MAX) || null;
  }

  if (o.firstName !== undefined) {
    if (o.firstName !== null && typeof o.firstName !== "string") {
      throw new EssaiError("Indiquez un prénom.", 422);
    }
    req.firstName = cleanText(o.firstName, ESSAI_FIRST_NAME_MAX) || null;
  }

  if (o.name !== undefined) {
    const name = cleanText(o.name, ESSAI_NAME_MAX);
    if (!name) throw new EssaiError("Indiquez le nom de votre commerce.", 422);
    req.name = name;
  }

  if (o.colors !== undefined && o.colors !== null) {
    if (typeof o.colors !== "object" || Array.isArray(o.colors)) {
      throw new EssaiError("Choisissez une couleur valide.", 422);
    }
    const c = o.colors as Record<string, unknown>;
    const colors: Partial<BrandColors> = {};
    for (const key of ["background", "text", "accent"] as const) {
      if (c[key] === undefined || c[key] === null) continue;
      const hex = normalizeHexColor(c[key]);
      if (!hex) throw new EssaiError("Choisissez une couleur valide.", 422);
      colors[key] = hex;
    }
    if (Object.keys(colors).length > 0) req.colors = colors;
  }

  return req;
}

// ─── Écriture concurrente sûre ───────────────────────────────────────────

interface CardSnapshot {
  name: string;
  card_type: string;
  stamp_count: number;
  reward_text: string;
  wallet_business_name: string | null;
  design: Record<string, unknown>;
  meta: EssaiMeta;
}

type CardPatch = Partial<Omit<CardSnapshot, "meta">> & { design: Record<string, unknown> };

/**
 * Compare-and-swap sur `cards.updated_at` (rafraîchi par trigger) : `mutate`
 * reçoit l'état À JOUR et renvoie le patch, ou `null` pour ne rien écrire.
 * Il peut lever (ex. carte gardée entre-temps) : rien n'est alors écrit.
 */
async function casUpdateCard(
  admin: SupabaseClient,
  cardId: string,
  mutate: (current: CardSnapshot) => CardPatch | null
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from("cards")
      .select("name, card_type, stamp_count, reward_text, wallet_business_name, design, updated_at")
      .eq("id", cardId)
      .single();
    if (error || !data) {
      throw new Error(`[essai/update] lecture de la carte : ${error?.message ?? "introuvable"}`);
    }
    const design = (data.design ?? {}) as Record<string, unknown>;
    const meta = parseEssaiMeta(design.essai);
    if (!meta) throw new Error("[essai/update] la carte n'est pas une carte d'essai");

    const patch = mutate({
      name: data.name as string,
      card_type: data.card_type as string,
      stamp_count: data.stamp_count as number,
      reward_text: data.reward_text as string,
      wallet_business_name: (data.wallet_business_name as string | null) ?? null,
      design,
      meta,
    });
    if (!patch) return false;

    const { data: updated, error: updateErr } = await admin
      .from("cards")
      .update(patch)
      .eq("id", cardId)
      .eq("updated_at", data.updated_at as string)
      .select("id");
    if (updateErr) throw new Error(`[essai/update] écriture de la carte : ${updateErr.message}`);
    if (updated && updated.length > 0) return true;
    // Une autre requête a modifié la carte entre-temps → on recommence.
  }
  throw new EssaiError("Trop de modifications en même temps. Réessayez dans un instant.", 409);
}

// ─── Garde-fous ──────────────────────────────────────────────────────────

const CLAIMED_ERROR =
  "Cette carte a déjà été gardée : retrouvez-la et modifiez-la depuis votre espace aswallet.";

export const ESSAI_CREATOR_ONLY_ERROR = "Seul le créateur de cette carte peut la modifier.";

function assertEditable(loaded: LoadedEssai, editKey: string | null | undefined): void {
  // En premier : un tiers n'apprend rien de l'état de la carte.
  if (!canEditEssai(loaded.meta, editKey)) throw new EssaiError(ESSAI_CREATOR_ONLY_ERROR, 403);
  if (loaded.meta.claimed) throw new EssaiError(CLAIMED_ERROR, 409);
  if (loaded.card.status !== "active" || loaded.instance.status !== "active") {
    throw new EssaiError("Cette carte n'est plus active.", 410);
  }
  if (loaded.expired) {
    throw new EssaiError(
      `Cette démo a expiré au bout de ${ESSAI_TTL_DAYS} jours. Créez une nouvelle carte en 30 secondes.`,
      410
    );
  }
}

async function loadEditable(
  token: string,
  editKey: string | null | undefined
): Promise<LoadedEssai> {
  const loaded = await loadEssai(token);
  if (!loaded) throw new EssaiError(ESSAI_NOT_FOUND_ERROR, 404);
  assertEditable(loaded, editKey);
  return loaded;
}

// ─── Mise à jour des wallets installés ───────────────────────────────────

/** Exécute une tâche après la réponse (ex. `after` de next/server). */
export type EssaiTaskScheduler = (task: () => Promise<void>) => void;

export interface EssaiUpdateOptions {
  /**
   * Planifie l'envoi aux wallets après la réponse HTTP (aperçu instantané).
   * Absent : l'envoi est attendu avant de rendre la main (scripts, tests).
   */
  schedule?: EssaiTaskScheduler;
  /**
   * Clé d'édition présentée par l'appelant (cookie `essai_k_<token>`).
   * Obligatoire pour toute carte qui porte une empreinte de clé (403 sinon).
   */
  editKey?: string | null;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
}

/** Paramètres Google Wallet de la carte d'essai (même forme que la route d'ajout). */
export function essaiGooglePassParams(loaded: LoadedEssai, url = appUrl()): PassParams {
  const { card, instance, meta } = loaded;
  const firstName = loaded.firstName;
  return {
    cardId: card.id,
    cardName: card.name,
    businessName: card.wallet_business_name || card.name,
    walletBusinessName: card.wallet_business_name,
    customerName: firstName || "Client",
    customerFirstName: firstName,
    customerInstanceToken: instance.token,
    stampsCollected: instance.stamps_collected,
    stampsTotal: card.stamp_count,
    rewardsAvailable: instance.rewards_available,
    rewardText: card.reward_text,
    bgColor: card.design.background_color || card.design.accent_color || "#1a1a1a",
    accentColor: card.design.accent_color ?? null,
    logoUrl: card.design.logo_url ?? null,
    bannerUrl: card.design.banner_url ?? null,
    appUrl: url,
    barcodeType: card.barcode_type ?? "qr",
    stampsLabel: card.design.label_stamps || null,
    cardKind: normalizeCardKind(card.card_type),
    bannerVersion: meta.design_version,
  };
}

/**
 * Pousse l'état actuel de la carte aux wallets où elle est installée, sans
 * notification visible (pas de `message`) :
 *  - Google : classe (nom, logo, couleur, titre, template) puis objet
 *    (bande versionnée, compteur, modules « Bonjour » / « Notre offre ») ;
 *  - Apple  : APNs → iOS refetch le pass (la carte client vient d'être
 *    touchée, son `updated_at` a changé).
 * Ne lève jamais : un wallet injoignable ne doit pas faire échouer la retouche.
 */
export async function syncEssaiWallets(
  loaded: LoadedEssai,
  opts: { classChanged: boolean }
): Promise<void> {
  const params = essaiGooglePassParams(loaded);
  const google = async () => {
    if (!isGoogleWalletConfigured()) return;
    if (opts.classChanged) await syncLoyaltyClass(params);
    await syncLoyaltyObject(
      params.customerInstanceToken,
      params.stampsCollected,
      params.rewardsAvailable,
      params.appUrl,
      undefined,
      params.stampsTotal,
      params.stampsLabel,
      params.cardKind,
      {
        bannerVersion: params.bannerVersion,
        textModules: buildGoogleTextModules(params.customerFirstName, params.rewardText),
      }
    );
  };
  const results = await Promise.allSettled([
    google(),
    pushAppleWalletUpdate(loaded.instance.token),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[essai/update] envoi wallet échoué :", r.reason);
  }
}

/** Nombre maximal de resynchronisations « rattrapage » par tâche. */
const MAX_SYNC_ROUNDS = 3;

/**
 * Envoie aux wallets le DERNIER état de la carte. Les tâches planifiées
 * après la réponse ne sont pas ordonnées (deux retouches rapprochées →
 * deux tâches concurrentes) : chaque tâche relit l'état courant, synchronise,
 * puis relit ; si `design_version` a bougé entre-temps, elle resynchronise
 * avec le dernier état. Le dernier envoi reflète donc toujours la dernière
 * retouche, quel que soit l'ordre d'arrivée chez Google. Ne lève jamais.
 */
async function syncLatestEssaiState(token: string, classChanged: boolean): Promise<void> {
  try {
    let current = await loadEssai(token);
    if (!current) return;
    let withClass = classChanged;
    for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
      await syncEssaiWallets(current, { classChanged: withClass });
      const latest = await loadEssai(token);
      if (!latest || latest.meta.design_version === current.meta.design_version) return;
      // Une autre retouche est passée pendant l'envoi : on ne sait pas
      // laquelle des deux tâches arrivera en dernier chez Google → on renvoie
      // le dernier état complet (classe comprise).
      current = latest;
      withClass = true;
    }
  } catch (err) {
    console.error("[essai/update] synchronisation des wallets échouée :", err);
  }
}

async function dispatchWalletSync(
  token: string,
  classChanged: boolean,
  options: EssaiUpdateOptions | undefined
): Promise<void> {
  const task = () => syncLatestEssaiState(token, classChanged);
  if (options?.schedule) options.schedule(task);
  else await task();
}

/**
 * Carte client : ajuste les tampons au nouveau compteur et, surtout, change
 * `updated_at` (trigger) — sinon le web service PassKit répondrait « rien de
 * neuf » à iOS et le pass installé ne se mettrait pas à jour.
 */
async function touchInstance(
  admin: SupabaseClient,
  loaded: LoadedEssai,
  fields: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await admin
    .from("card_instances")
    .update({ status: loaded.instance.status, ...fields })
    .eq("id", loaded.instance.id);
  if (error) throw new Error(`[essai/update] carte client : ${error.message}`);
}

async function reloadView(token: string): Promise<EssaiCardView> {
  const loaded = await loadEssai(token);
  if (!loaded) throw new EssaiError(ESSAI_NOT_FOUND_ERROR, 404);
  return buildEssaiCardView(loaded);
}

// ─── Fichiers du bucket ──────────────────────────────────────────────────

/** `essai/<cardId>/…` depuis l'URL publique du bucket (null si hors bucket). */
function essaiAssetPath(url: unknown, cardId: string): string | null {
  if (typeof url !== "string") return null;
  const marker = `/storage/v1/object/public/${ESSAI_ASSETS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
    return path.startsWith(`essai/${cardId}/`) ? path : null;
  } catch {
    return null;
  }
}

/** Supprime des fichiers de la démo ; ne lève jamais (log seulement). */
async function removeEssaiAssets(
  admin: SupabaseClient,
  paths: string[],
  label: string
): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await admin.storage.from(ESSAI_ASSETS_BUCKET).remove(paths);
    if (error) console.warn(`[essai/update] ${label} :`, error.message);
  } catch (err) {
    console.warn(`[essai/update] ${label} :`, err);
  }
}

/** Ancien fichier remplacé (`previousUrl`) supprimé s'il appartient à la démo. */
async function removeReplacedAsset(
  admin: SupabaseClient,
  previousUrl: unknown,
  newPath: string,
  cardId: string
): Promise<void> {
  const oldPath = essaiAssetPath(previousUrl, cardId);
  if (oldPath && oldPath !== newPath) {
    await removeEssaiAssets(admin, [oldPath], "ancien fichier non supprimé");
  }
}

// ─── Logo typographique ──────────────────────────────────────────────────

interface TypographicLogoRequest {
  /** Initiales + fond + accent : tout ce dont dépend le rendu. */
  key: string;
  name: string;
  colors: BrandColors;
}

interface UploadedTypographicLogo {
  key: string;
  path: string;
  url: string;
}

function typographicLogoKey(name: string, colors: BrandColors): string {
  return `${initialsOf(name)}|${colors.background}|${colors.accent}`;
}

/** Rend le logo (initiales) et l'envoie sous un chemin neuf (immuable). */
async function uploadTypographicLogo(
  admin: SupabaseClient,
  cardId: string,
  want: TypographicLogoRequest
): Promise<UploadedTypographicLogo> {
  const logo = await typographicLogo(want.name, want.colors);
  const png = await ensurePng(logo.png);
  const path = `essai/${cardId}/logo-${Date.now()}.png`;
  const url = await uploadEssaiAsset(admin, path, png, "image/png");
  return { key: want.key, path, url };
}

// ─── PATCH : type, offre, prénom, nom, couleurs ──────────────────────────

/** Offre écrite par le module brand pour le métier + type, revalidée. */
function autoOffer(meta: EssaiMeta, type: EssaiCardType, name: string) {
  const o = offerFor(meta.category, type, name);
  return {
    rewardText: cleanText(o.rewardText, ESSAI_REWARD_MAX),
    labelStamps: cleanText(o.labelStamps, 14),
    stampCount: Math.min(MAX_STAMPS, Math.max(MIN_STAMPS, Math.round(Number(o.stampCount) || 10))),
    promoMessage: cleanText(o.promoMessage, 120),
  };
}


/** Résultat du calcul d'une retouche sur un état donné de la carte. */
interface UpdatePlan {
  type: EssaiCardType;
  previousType: EssaiCardType;
  stampCount: number;
  firstName: string | null;
  firstNameChanged: boolean;
  /** Patch de la carte (hors logo typographique régénéré). */
  patch: CardPatch;
  /** Logo typographique à régénérer (initiales / couleurs changées). */
  logo: TypographicLogoRequest | null;
}

/**
 * Calcule la retouche à appliquer sur l'état `cur` (fonction pure, rejouée
 * à chaque passage du compare-and-swap). `null` si rien ne change.
 */
function planUpdate(
  req: EssaiUpdateRequest,
  cur: CardSnapshot,
  currentFirstName: string | null
): UpdatePlan | null {
  const design = cur.design;
  const meta = cur.meta;
  const previousType = essaiCardType(cur.card_type);
  const type = req.cardType ?? previousType;
  const typeChanged = type !== previousType;
  const name = req.name ?? cur.name;

  let rewardText = cur.reward_text;
  let labelStamps = typeof design.label_stamps === "string" ? design.label_stamps : "Tampons";
  let stampCount = cur.stamp_count;
  let promo = meta.promo_message;

  // Offre réécrite pour le métier + type : demandée explicitement (null),
  // ou changement de type sans offre fournie. Le libellé et le compteur
  // suivent alors l'offre (« 10 passages = … » ↔ 10 cases).
  const rewrite = req.rewardText === null || (typeChanged && req.rewardText === undefined);
  if (typeChanged || rewrite) {
    const offer = autoOffer(meta, type, name);
    labelStamps = offer.labelStamps || labelStamps;
    stampCount = offer.stampCount;
    if (offer.promoMessage) promo = offer.promoMessage;
    if (rewrite && offer.rewardText) rewardText = offer.rewardText;
  }
  if (typeof req.rewardText === "string") rewardText = req.rewardText;
  if (name !== cur.name && !(typeChanged || rewrite) && cur.name) {
    promo = promo.split(cur.name).join(name);
  }

  const firstNameChanged =
    req.firstName !== undefined && (req.firstName ?? null) !== (currentFirstName ?? null);
  const firstName = req.firstName !== undefined ? req.firstName ?? null : currentFirstName;

  const background =
    req.colors?.background ?? normalizeHexColor(design.background_color) ?? "#141414";
  const accent = req.colors?.accent ?? normalizeHexColor(design.accent_color) ?? "#fbbf24";
  const text = readableTextColor(
    background,
    req.colors?.text ?? normalizeHexColor(design.text_color)
  );

  const changed =
    typeChanged ||
    name !== cur.name ||
    rewardText !== cur.reward_text ||
    stampCount !== cur.stamp_count ||
    labelStamps !== design.label_stamps ||
    firstNameChanged ||
    background !== design.background_color ||
    accent !== design.accent_color ||
    text !== design.text_color;
  if (!changed) return null;

  // Logo typographique = initiales du nom sur un badge aux couleurs de la
  // carte : à refaire si les initiales, le fond ou l'accent changent.
  const colors: BrandColors = { background, text, accent };
  const logo =
    meta.logo_kind === "typographic" &&
    (initialsOf(name) !== initialsOf(cur.name) ||
      background !== design.background_color ||
      accent !== design.accent_color)
      ? { key: typographicLogoKey(name, colors), name, colors }
      : null;

  const nextMeta: EssaiMeta = {
    ...meta,
    card_type: type,
    promo_message: promo,
    first_name: firstName,
    design_version: meta.design_version + 1,
  };
  return {
    type,
    previousType,
    stampCount,
    firstName,
    firstNameChanged,
    logo,
    patch: {
      name,
      wallet_business_name: name,
      card_type: type,
      stamp_count: stampCount,
      reward_text: rewardText,
      design: {
        ...design,
        background_color: background,
        text_color: text,
        accent_color: accent,
        label_stamps: labelStamps,
        essai: nextMeta,
      },
    },
  };
}

function snapshotOf(loaded: LoadedEssai): CardSnapshot {
  return {
    name: loaded.card.name,
    card_type: loaded.card.card_type,
    stamp_count: loaded.card.stamp_count,
    reward_text: loaded.card.reward_text,
    wallet_business_name: loaded.card.wallet_business_name,
    design: loaded.card.design as Record<string, unknown>,
    meta: loaded.meta,
  };
}

/** Passages max quand le logo à régénérer change sous nos pieds. */
const MAX_LOGO_ROUNDS = 3;

export async function updateEssaiCard(
  token: string,
  rawRequest: unknown,
  options?: EssaiUpdateOptions
): Promise<EssaiCardView> {
  const req = parseEssaiUpdateRequest(rawRequest);
  const loaded = await loadEditable(token, options?.editKey);
  const admin = createAdminClient();
  const cardId = loaded.card.id;

  // Logo typographique préparé AVANT l'écriture (rendu + upload asynchrones,
  // le compare-and-swap reste synchrone), d'après l'état qu'on vient de lire.
  // S'il ne peut pas être produit, la retouche passe quand même (ancien logo
  // conservé) : un badge d'initiales ne doit pas bloquer un renommage.
  let logoUnavailable = false;
  const prepareLogo = async (want: TypographicLogoRequest) => {
    try {
      return await uploadTypographicLogo(admin, cardId, want);
    } catch (err) {
      console.error("[essai/update] logo typographique non régénéré :", err);
      logoUnavailable = true;
      return null;
    }
  };
  const initialPlan = planUpdate(req, snapshotOf(loaded), loaded.firstName);
  let logo: UploadedTypographicLogo | null = initialPlan?.logo
    ? await prepareLogo(initialPlan.logo)
    : null;

  // Rempli par le dernier passage (réussi) du compare-and-swap.
  interface RoundState {
    applied: UpdatePlan | null;
    /** Logo nécessaire mais pas (ou plus) celui préparé → nouveau passage. */
    missingLogo: TypographicLogoRequest | null;
    logoUsed: boolean;
    previousLogoUrl: unknown;
  }
  let outcome: RoundState;

  try {
    for (let round = 0; ; round++) {
      const st: RoundState = {
        applied: null,
        missingLogo: null,
        logoUsed: false,
        previousLogoUrl: null,
      };
      await casUpdateCard(admin, cardId, (cur) => {
        if (cur.meta.claimed) throw new EssaiError(CLAIMED_ERROR, 409);
        st.applied = null;
        st.missingLogo = null;
        st.logoUsed = false;
        const plan = planUpdate(req, cur, loaded.firstName);
        if (!plan) return null;
        let patch = plan.patch;
        if (plan.logo && !logoUnavailable) {
          // Nom / couleurs changés entre-temps : le logo préparé ne
          // correspond plus → on renonce à ce passage et on le refait.
          if (!logo || logo.key !== plan.logo.key) {
            st.missingLogo = plan.logo;
            return null;
          }
          st.previousLogoUrl = cur.design.logo_url;
          st.logoUsed = true;
          patch = { ...patch, design: { ...patch.design, logo_url: logo.url } };
        }
        st.applied = plan;
        return patch;
      });
      if (!st.missingLogo) {
        outcome = st;
        break;
      }
      if (round + 1 >= MAX_LOGO_ROUNDS) {
        throw new EssaiError("Trop de modifications en même temps. Réessayez dans un instant.", 409);
      }
      const stale = logo;
      logo = null;
      if (stale) await removeEssaiAssets(admin, [stale.path], "logo inutilisé non supprimé");
      logo = await prepareLogo(st.missingLogo);
    }
  } catch (err) {
    // Rien n'a été écrit : le logo neuf (s'il existe) est supprimé.
    if (logo) await removeEssaiAssets(admin, [logo.path], "nettoyage du logo échoué");
    throw err;
  }

  // Ménage du bucket : ancien logo remplacé, ou logo préparé mais inutile
  // (la retouche a été annulée / rendue sans objet entre-temps).
  if (logo) {
    if (outcome.logoUsed) await removeReplacedAsset(admin, outcome.previousLogoUrl, logo.path, cardId);
    else await removeEssaiAssets(admin, [logo.path], "logo inutilisé non supprimé");
  }

  // Rien n'a changé : on renvoie la carte telle quelle.
  const applied = outcome.applied;
  if (!applied) return buildEssaiCardView(loaded);

  if (applied.firstNameChanged) {
    const { error } = await admin
      .from("clients")
      .update({ first_name: applied.firstName })
      .eq("id", loaded.instance.client_id);
    if (error) throw new Error(`[essai/update] prénom : ${error.message}`);
  }

  // Tampons cohérents avec le nouveau compteur (jamais une carte « pleine »
  // affichée), et grille « vivante » quand on passe à un type à compteur.
  const { stamps_collected: stamps, total_stamps_ever: total } = loaded.instance;
  const instanceFields: Record<string, unknown> = {};
  if (isCounterCardType(applied.type)) {
    let target = Math.min(stamps, applied.stampCount - 1);
    if (!isCounterCardType(applied.previousType) && stamps === 0) {
      target = Math.min(ESSAI_INITIAL_STAMPS, applied.stampCount - 1);
    }
    target = Math.max(0, target);
    if (target !== stamps) {
      instanceFields.stamps_collected = target;
      instanceFields.total_stamps_ever = Math.max(total, target);
    }
  }
  await touchInstance(admin, loaded, instanceFields);

  const view = await reloadView(token);
  await dispatchWalletSync(token, true, options);
  return view;
}

// ─── Média : logo / photo déposés ────────────────────────────────────────

export type EssaiMediaKind = "logo" | "photo";

export function isEssaiMediaKind(value: unknown): value is EssaiMediaKind {
  return value === "logo" || value === "photo";
}

const MEDIA_ERROR = "Cette image n'a pas pu être utilisée, réessayez avec une autre photo.";

/** Suggestions satisfaites par un envoi : un logo règle aussi la capture. */
const MEDIA_DONE: Record<EssaiMediaKind, readonly EssaiSuggestion[]> = {
  logo: ["add_logo", "add_screenshot"],
  photo: ["add_photo"],
};

export async function updateEssaiMedia(
  token: string,
  kind: EssaiMediaKind,
  image: UploadedImage,
  options?: EssaiUpdateOptions
): Promise<EssaiCardView> {
  if (!isEssaiMediaKind(kind)) throw new EssaiError("Requête invalide.", 400);
  const loaded = await loadEditable(token, options?.editKey);
  const admin = createAdminClient();
  const cardId = loaded.card.id;
  const ts = Date.now();

  // 1. Normalisation par le module brand (badge 512 / photo paysage).
  let body: Buffer;
  let logoKind: "real" | "typographic" = "real";
  let photoSource: EssaiMeta["photo_source"] = "upload";
  try {
    if (kind === "logo") {
      const logo = await logoFromUpload(image);
      body = await ensurePng(logo.png);
      logoKind = logo.kind === "typographic" ? "typographic" : "real";
    } else {
      const photo = await photoFromUpload(image);
      body = await ensureJpeg(photo.jpeg);
      photoSource = photo.source ?? "upload";
    }
  } catch (err) {
    console.warn(`[essai/media] ${kind} inutilisable :`, err);
    throw new EssaiError(MEDIA_ERROR, 422);
  }

  // 2. Upload sous un chemin neuf (immuable, cache long).
  const path =
    kind === "logo" ? `essai/${cardId}/logo-${ts}.png` : `essai/${cardId}/photo-${ts}.jpg`;
  const url = await uploadEssaiAsset(
    admin,
    path,
    body,
    kind === "logo" ? "image/png" : "image/jpeg"
  );

  // 3. Écriture (CAS) ; en cas d'échec le fichier neuf est supprimé.
  let previousUrl: unknown = null;
  const field = kind === "logo" ? "logo_url" : "banner_url";
  const done = MEDIA_DONE[kind];
  try {
    await casUpdateCard(admin, cardId, (cur) => {
      if (cur.meta.claimed) throw new EssaiError(CLAIMED_ERROR, 409);
      previousUrl = cur.design[field];
      const nextMeta: EssaiMeta = {
        ...cur.meta,
        ...(kind === "logo" ? { logo_kind: logoKind } : { photo_source: photoSource }),
        suggestions: cur.meta.suggestions.filter((s) => !done.includes(s)),
        design_version: cur.meta.design_version + 1,
      };
      return { design: { ...cur.design, [field]: url, essai: nextMeta } };
    });
  } catch (err) {
    await removeEssaiAssets(admin, [path], "nettoyage échoué");
    throw err;
  }

  // 4. Ancien fichier de la démo supprimé (le bucket reste propre).
  await removeReplacedAsset(admin, previousUrl, path, cardId);

  await touchInstance(admin, loaded);
  const view = await reloadView(token);
  // Logo : la classe Google porte le logo. Photo : seule la bande (objet) change.
  await dispatchWalletSync(token, kind === "logo", options);
  return view;
}
