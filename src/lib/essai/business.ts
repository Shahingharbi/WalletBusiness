import type { SupabaseClient } from "@supabase/supabase-js";
import { ESSAI_BUSINESS_SLUG } from "@/lib/essai/types";

/**
 * Commerce interne qui porte toutes les cartes d'essai (« Essai aswallet »).
 *
 * Pourquoi un vrai commerce plutôt qu'une table dédiée : les routes wallet
 * existantes (/api/apple-wallet, /api/google-wallet, bannière, PassKit Web
 * Service) lisent `cards` + `card_instances` + `businesses`. En rattachant la
 * démo à un commerce réel, la carte du prospect est une VRAIE carte,
 * installable et mise à jour exactement comme celle d'un client payant, sans
 * aucune migration SQL ni code wallet spécifique.
 *
 * Le commerce est créé paresseusement au premier essai (pas de seed à
 * maintenir entre environnements) et son id est mis en cache au niveau du
 * module : une seule requête par instance serverless.
 */

const ESSAI_BUSINESS_NAME = "Essai aswallet";

/** Code Postgres « unique_violation » (slug déjà pris par un appel concurrent). */
const PG_UNIQUE_VIOLATION = "23505";

let cachedId: string | null = null;
/** Création en cours : deux requêtes simultanées partagent la même promesse. */
let inflight: Promise<string> | null = null;

async function findBySlug(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from("businesses")
    .select("id")
    .eq("slug", ESSAI_BUSINESS_SLUG)
    .maybeSingle();
  if (error) {
    throw new Error(`[essai/business] lecture du commerce essai : ${error.message}`);
  }
  return (data?.id as string | undefined) ?? null;
}

async function createOrFetch(admin: SupabaseClient): Promise<string> {
  const existing = await findBySlug(admin);
  if (existing) return existing;

  // `businesses.owner_id` est NOT NULL (→ auth.users) : on rattache le
  // commerce au premier super_admin (le fondateur), ce qui le rend aussi
  // visible dans /admin sans donner d'accès à un compte commerçant.
  const { data: owner, error: ownerErr } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerErr) {
    throw new Error(`[essai/business] lecture du super_admin : ${ownerErr.message}`);
  }
  if (!owner?.id) {
    throw new Error(
      "[essai/business] aucun profil super_admin : impossible de créer le commerce essai"
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from("businesses")
    .insert({
      owner_id: owner.id,
      name: ESSAI_BUSINESS_NAME,
      slug: ESSAI_BUSINESS_SLUG,
      is_active: true,
      // Abonnement actif « Réseau » : aucun gating (cartes / clients
      // illimités) ne doit jamais bloquer une démo.
      subscription_status: "active",
      subscription_plan: "enterprise",
      onboarding_completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    // Course : une autre instance vient de créer le commerce → on le relit.
    if (insertErr.code === PG_UNIQUE_VIOLATION) {
      const raced = await findBySlug(admin);
      if (raced) return raced;
    }
    throw new Error(`[essai/business] création du commerce essai : ${insertErr.message}`);
  }
  return inserted.id as string;
}

/**
 * Id du commerce essai (créé au besoin). Idempotent et sûr en concurrence :
 * cache module + promesse partagée + relecture sur conflit d'unicité du slug.
 */
export async function getEssaiBusinessId(admin: SupabaseClient): Promise<string> {
  if (cachedId) return cachedId;
  if (!inflight) {
    inflight = createOrFetch(admin)
      .then((id) => {
        cachedId = id;
        return id;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Id du commerce essai SANS le créer (lecture seule : page admin, chargement
 * d'une carte). `null` si aucun essai n'a encore jamais été créé.
 */
export async function findEssaiBusinessId(
  admin: SupabaseClient
): Promise<string | null> {
  if (cachedId) return cachedId;
  const id = await findBySlug(admin);
  if (id) cachedId = id;
  return id;
}
