import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCardKind, walletBannerPath } from "@/lib/apple-wallet";
import { findEssaiBusinessId } from "@/lib/essai/business";
import {
  ESSAI_CARD_TYPES,
  ESSAI_CATEGORIES,
  type BrandPhoto,
  type EssaiCardType,
  type EssaiCardView,
  type EssaiCategory,
  type EssaiMeta,
  type EssaiSource,
  type EssaiSuggestion,
  type EssaiSummaryResponse,
  type StampShape,
} from "@/lib/essai/types";

/**
 * Chargement d'une carte d'essai par le token de sa carte client
 * (`card_instances.token`, le même que dans l'URL /essai/<token> et que le
 * serial du pass Apple).
 *
 * Règle de sécurité centrale de la démo : seules les cartes du commerce
 * interne « aswallet-essai » sont acceptées. Un token de carte d'un vrai
 * commerce renvoie `null` → 404 côté routes : impossible de piloter (tampon,
 * promo…) la carte d'un client réel via les endpoints publics de la démo.
 */

/** Durée de vie de la démo : au-delà, les tests en direct sont désactivés. */
export const ESSAI_TTL_DAYS = 7;
const ESSAI_TTL_MS = ESSAI_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Tokens générés par la DB = 32 caractères hex ; on reste tolérant mais borné. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function isPlausibleEssaiToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

/** `cards.design` d'une carte d'essai (DEFAULT_CARD_DESIGN + marque + meta). */
export interface EssaiCardDesign {
  background_color: string;
  text_color: string;
  accent_color: string;
  logo_url: string | null;
  /** Photo de la bande (JPEG paysage) — obligatoire depuis la v2. */
  banner_url?: string | null;
  stamp_icon: string;
  stamp_shape: StampShape;
  label_stamps: string;
  essai: EssaiMeta;
  [key: string]: unknown;
}

export interface EssaiCardRow {
  id: string;
  business_id: string;
  name: string;
  status: string;
  card_type: string;
  barcode_type: "qr" | "pdf417";
  stamp_count: number;
  reward_text: string;
  wallet_business_name: string | null;
  design: EssaiCardDesign;
  created_at: string;
  updated_at: string;
}

export interface EssaiInstanceRow {
  id: string;
  token: string;
  card_id: string;
  client_id: string;
  business_id: string;
  stamps_collected: number;
  rewards_available: number;
  total_stamps_ever: number;
  status: string;
  created_at: string;
}

export interface LoadedEssai {
  card: EssaiCardRow;
  instance: EssaiInstanceRow;
  meta: EssaiMeta;
  /**
   * Prénom de la carte client (`clients.first_name`, source de vérité des
   * wallets : « Bonjour <prénom> »), à défaut celui de la meta.
   */
  firstName: string | null;
  /** Date (ISO) à laquelle les tests en direct se désactivent. */
  expiresAt: string;
  /** `true` passé {@link ESSAI_TTL_DAYS} jours : actions de démo refusées. */
  expired: boolean;
}

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
const SHAPES: readonly StampShape[] = ["circle", "squircle", "shield", "star", "hex"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function count(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Valeur de `cards.card_type` → type de carte d'essai (défaut « stamp »). */
export function essaiCardType(value: unknown): EssaiCardType {
  return (ESSAI_CARD_TYPES as readonly unknown[]).includes(value)
    ? (value as EssaiCardType)
    : "stamp";
}

/**
 * Valide et normalise `design.essai` (JSONB non typé). `null` si absent ou
 * d'une version inconnue — la carte n'est alors pas traitée comme un essai.
 *
 * Les cartes créées avant la v2 (sans type, photo ni version de design)
 * reçoivent des valeurs par défaut sûres : type « stamp », version 1.
 */
export function parseEssaiMeta(raw: unknown): EssaiMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;

  const category = (ESSAI_CATEGORIES as readonly string[]).includes(o.category as string)
    ? (o.category as EssaiCategory)
    : "autre";
  const source = SOURCES.includes(o.source as EssaiSource)
    ? (o.source as EssaiSource)
    : "website";

  const loc = o.location as { lat?: unknown; lng?: unknown } | null | undefined;
  const location =
    loc && typeof loc.lat === "number" && typeof loc.lng === "number"
      ? { lat: loc.lat, lng: loc.lng }
      : null;

  const actions = (o.actions ?? {}) as Record<string, unknown>;
  const claimedRaw = o.claimed as Record<string, unknown> | null | undefined;
  const claimed =
    claimedRaw &&
    typeof claimedRaw.business_id === "string" &&
    typeof claimedRaw.card_id === "string"
      ? {
          business_id: claimedRaw.business_id,
          card_id: claimedRaw.card_id,
          at: typeof claimedRaw.at === "string" ? claimedRaw.at : new Date(0).toISOString(),
        }
      : null;

  const suggestions = Array.isArray(o.suggestions)
    ? SUGGESTIONS.filter((s) => (o.suggestions as unknown[]).includes(s))
    : [];
  const designVersion = Number(o.design_version);

  // Clé d'édition : TOUJOURS conservée (chaque écriture repart de cette
  // meta parsée : la perdre rendrait la carte modifiable par tous). Une
  // valeur inattendue est gardée sous une forme qui ne correspond à aucune
  // clé : on échoue fermé.
  const editKeyHash =
    o.edit_key_hash === undefined || o.edit_key_hash === null
      ? undefined
      : typeof o.edit_key_hash === "string"
        ? o.edit_key_hash
        : "invalid";

  return {
    v: 1,
    source,
    source_url: str(o.source_url),
    category,
    palette: Array.isArray(o.palette)
      ? o.palette.filter((c): c is string => typeof c === "string")
      : [],
    logo_kind: o.logo_kind === "real" ? "real" : "typographic",
    review_url: str(o.review_url),
    promo_message: typeof o.promo_message === "string" ? o.promo_message : "",
    address: str(o.address),
    location,
    website: str(o.website),
    ai_used: o.ai_used === true,
    suggestions,
    card_type: essaiCardType(o.card_type),
    photo_source: PHOTO_SOURCES.includes(o.photo_source as BrandPhoto["source"])
      ? (o.photo_source as BrandPhoto["source"])
      : "stock",
    first_name: str(o.first_name)?.trim() ?? null,
    design_version:
      Number.isFinite(designVersion) && designVersion >= 1 ? Math.floor(designVersion) : 1,
    created_at: typeof o.created_at === "string" ? o.created_at : new Date(0).toISOString(),
    actions: {
      stamp: count(actions.stamp),
      promo: count(actions.promo),
      review: count(actions.review),
    },
    claimed,
    ...(editKeyHash !== undefined ? { edit_key_hash: editKeyHash } : {}),
  };
}

// ─── Clé d'édition (réservée au créateur de la carte) ────────────────────

/** Durée de vie du cookie de clé d'édition (= durée de la démo). */
export const ESSAI_EDIT_COOKIE_MAX_AGE = ESSAI_TTL_DAYS * 24 * 60 * 60;

/** Nom du cookie httpOnly qui porte la clé d'édition de `token`. */
export function essaiEditCookieName(token: string): string {
  return `essai_k_${token}`;
}

/** Nouvelle clé d'édition (192 bits aléatoires, base64url). */
export function generateEssaiEditKey(): string {
  return randomBytes(24).toString("base64url");
}

/** SHA-256 hex de la clé d'édition (seule cette empreinte est stockée). */
export function hashEssaiEditKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * `true` si la clé fournie (cookie) autorise les retouches de la carte.
 * Carte sans empreinte (v1 ancienne) : autorisé, pour la compatibilité.
 * Comparaison à temps constant.
 */
export function canEditEssai(meta: EssaiMeta, key: string | null | undefined): boolean {
  if (meta.edit_key_hash === undefined) return true;
  if (typeof key !== "string" || key.length === 0 || key.length > 256) return false;
  const expected = /^[0-9a-f]{64}$/i.test(meta.edit_key_hash)
    ? Buffer.from(meta.edit_key_hash, "hex")
    : null;
  if (!expected) return false;
  const actual = Buffer.from(hashEssaiEditKey(key), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Date d'expiration de la démo (à partir de la création de la carte). */
export function essaiExpiry(createdAtIso: string): { expiresAt: string; expired: boolean } {
  const created = new Date(createdAtIso).getTime();
  const expiresAtMs = (Number.isFinite(created) ? created : Date.now()) + ESSAI_TTL_MS;
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    expired: Date.now() > expiresAtMs,
  };
}

const INSTANCE_SELECT = `
  id, token, card_id, client_id, business_id, stamps_collected,
  rewards_available, total_stamps_ever, status, created_at,
  cards(id, business_id, name, status, card_type, barcode_type, stamp_count,
        reward_text, wallet_business_name, design, created_at, updated_at),
  clients(first_name)
`;

/**
 * Charge une carte d'essai par token. `null` si le token est invalide, si la
 * carte n'existe pas ou si elle n'appartient PAS au commerce essai.
 */
export async function loadEssai(token: string): Promise<LoadedEssai | null> {
  if (!isPlausibleEssaiToken(token)) return null;

  const admin = createAdminClient();
  // Lecture seule : si aucun essai n'a encore été créé, aucun token ne peut
  // être un essai — inutile de créer le commerce ici.
  const essaiBusinessId = await findEssaiBusinessId(admin);
  if (!essaiBusinessId) return null;

  const { data, error } = await admin
    .from("card_instances")
    .select(INSTANCE_SELECT)
    .eq("token", token)
    .eq("business_id", essaiBusinessId)
    .maybeSingle();

  if (error) {
    throw new Error(`[essai/load] lecture de la carte : ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as EssaiInstanceRow & {
    cards: EssaiCardRow | null;
    clients: { first_name: string | null } | null;
  };
  const card = row.cards;
  // Double contrôle : l'instance ET la carte doivent appartenir à l'essai.
  if (!card || card.business_id !== essaiBusinessId) return null;

  const meta = parseEssaiMeta((card.design as { essai?: unknown } | null)?.essai);
  if (!meta) return null;

  const instance: EssaiInstanceRow = {
    id: row.id,
    token: row.token,
    card_id: row.card_id,
    client_id: row.client_id,
    business_id: row.business_id,
    stamps_collected: row.stamps_collected,
    rewards_available: row.rewards_available,
    total_stamps_ever: row.total_stamps_ever,
    status: row.status,
    created_at: row.created_at,
  };
  const { expiresAt, expired } = essaiExpiry(meta.created_at || card.created_at);
  const firstName = str(row.clients?.first_name)?.trim() ?? meta.first_name;

  return {
    card: { ...card, design: { ...card.design, essai: meta } },
    instance,
    meta,
    firstName,
    expiresAt,
    expired,
  };
}

/** Résumé public (GET /api/essai/[token], utilisé par /register). */
export function buildEssaiSummary(loaded: LoadedEssai): EssaiSummaryResponse {
  const { card, instance, meta } = loaded;
  return {
    token: instance.token,
    cardId: card.id,
    name: card.name,
    logoUrl: card.design.logo_url ?? null,
    colors: {
      background: card.design.background_color,
      text: card.design.text_color,
      accent: card.design.accent_color,
    },
    rewardText: card.reward_text,
    claimed: meta.claimed !== null,
  };
}

/**
 * Vue complète pour l'aperçu « réplique Wallet » et les retouches en direct
 * (GET ?view=full, PATCH, POST media). `bannerUrl` est la VRAIE bande servie
 * aux wallets, versionnée par `design_version` (cache-bust après retouche).
 */
export function buildEssaiCardView(loaded: LoadedEssai): EssaiCardView {
  const { card, instance, meta } = loaded;
  const cardType = essaiCardType(card.card_type);
  const kind = normalizeCardKind(cardType);
  const stampCount = Math.max(1, Math.floor(Number(card.stamp_count) || 1));
  const stamps = Math.max(0, Math.min(instance.stamps_collected, stampCount));
  return {
    ...buildEssaiSummary(loaded),
    category: meta.category,
    cardType,
    logoKind: meta.logo_kind,
    photoUrl: str(card.design.banner_url) ?? null,
    stamps,
    stampCount,
    rewards: instance.rewards_available,
    labelStamps: card.design.label_stamps || "Tampons",
    stampIcon: card.design.stamp_icon || "check",
    stampShape: SHAPES.includes(card.design.stamp_shape) ? card.design.stamp_shape : "circle",
    firstName: loaded.firstName,
    bannerUrl: walletBannerPath(instance.token, stamps, kind, meta.design_version),
    designVersion: meta.design_version,
    suggestions: meta.suggestions,
    expired: loaded.expired,
    expiresAt: loaded.expiresAt,
  };
}

/**
 * Page publique d'installation à viser depuis l'affiche comptoir (QR) :
 * `/c/<cardId>` de la VRAIE carte si la démo a été gardée (et que cette
 * carte est active), sinon `/c/<cardId>` de la carte d'essai. Jamais
 * `/essai/<token>` (token de la carte client de démo du créateur).
 */
export async function essaiInstallUrl(loaded: LoadedEssai, appUrl: string): Promise<string> {
  const base = appUrl.replace(/\/$/, "");
  const claimed = loaded.meta.claimed;
  if (claimed) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cards")
      .select("id")
      .eq("id", claimed.card_id)
      .eq("status", "active")
      .maybeSingle();
    if (error) console.warn("[essai/load] carte gardée illisible :", error.message);
    if (data) return `${base}/c/${encodeURIComponent(claimed.card_id)}`;
  }
  return `${base}/c/${encodeURIComponent(loaded.card.id)}`;
}

/**
 * Met à jour `cards.design.essai` de façon sûre en concurrence
 * (compare-and-swap sur `updated_at`, rafraîchi par trigger à chaque UPDATE).
 *
 * `mutate` reçoit la meta à jour et renvoie la nouvelle meta, ou `null` pour
 * ne rien écrire. Deux requêtes simultanées (double clic, deux onglets) ne
 * s'écrasent donc jamais : la perdante relit et réapplique sa modification.
 *
 * Renvoie la meta finale et `written` (false si `mutate` a renoncé).
 */
export async function updateEssaiMeta(
  admin: SupabaseClient,
  cardId: string,
  mutate: (current: EssaiMeta) => EssaiMeta | null
): Promise<{ meta: EssaiMeta; written: boolean }> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: card, error } = await admin
      .from("cards")
      .select("design, updated_at")
      .eq("id", cardId)
      .single();
    if (error || !card) {
      throw new Error(`[essai/meta] lecture de la carte : ${error?.message ?? "introuvable"}`);
    }

    const design = (card.design ?? {}) as Record<string, unknown>;
    const current = parseEssaiMeta(design.essai);
    if (!current) {
      throw new Error("[essai/meta] la carte n'est pas une carte d'essai");
    }

    const next = mutate(current);
    if (!next) return { meta: current, written: false };

    const { data: updated, error: updateErr } = await admin
      .from("cards")
      .update({ design: { ...design, essai: next } })
      .eq("id", cardId)
      .eq("updated_at", card.updated_at as string)
      .select("id");
    if (updateErr) {
      throw new Error(`[essai/meta] écriture de la carte : ${updateErr.message}`);
    }
    if (updated && updated.length > 0) return { meta: next, written: true };
    // Une autre requête a modifié la carte entre-temps → on recommence.
  }
  throw new Error("[essai/meta] trop de modifications concurrentes");
}
