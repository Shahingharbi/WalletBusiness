import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { findEssaiBusinessId } from "@/lib/essai/business";
import {
  ESSAI_CATEGORIES,
  type EssaiCategory,
  type EssaiMeta,
  type EssaiSource,
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
  /** Date (ISO) à laquelle les tests en direct se désactivent. */
  expiresAt: string;
  /** `true` passé {@link ESSAI_TTL_DAYS} jours : actions de démo refusées. */
  expired: boolean;
}

const SOURCES: readonly EssaiSource[] = ["website", "maps", "instagram", "photo", "name"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function count(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Valide et normalise `design.essai` (JSONB non typé). `null` si absent ou
 * d'une version inconnue — la carte n'est alors pas traitée comme un essai.
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
    warnings: Array.isArray(o.warnings)
      ? o.warnings.filter((w): w is string => typeof w === "string")
      : [],
    created_at: typeof o.created_at === "string" ? o.created_at : new Date(0).toISOString(),
    actions: {
      stamp: count(actions.stamp),
      promo: count(actions.promo),
      review: count(actions.review),
    },
    claimed,
  };
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
        reward_text, wallet_business_name, design, created_at, updated_at)
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

  const row = data as unknown as EssaiInstanceRow & { cards: EssaiCardRow | null };
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

  return {
    card: { ...card, design: { ...card.design, essai: meta } },
    instance,
    meta,
    expiresAt,
    expired,
  };
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
