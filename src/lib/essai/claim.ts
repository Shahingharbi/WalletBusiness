import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { requirePlan, type BusinessBillingState } from "@/lib/billing";
import { REVIEW_DEFAULT_DELAY, isValidReviewUrl } from "@/lib/google-review";
import { findEssaiBusinessId } from "@/lib/essai/business";
import { EssaiError, ESSAI_NOT_FOUND_ERROR } from "@/lib/essai/errors";
import { loadEssai, updateEssaiMeta, type LoadedEssai } from "@/lib/essai/load";
import type { EssaiCategory, EssaiClaimResponse } from "@/lib/essai/types";

/**
 * « Je garde ma carte » : copie la carte d'essai dans le commerce du compte
 * qui vient de s'inscrire / se connecter — zéro ressaisie.
 *
 * - L'identité (`userId`) est vérifiée par l'appelant via la session
 *   Supabase (cookie) ; ici toutes les écritures passent par le service role.
 * - Idempotent : un second appel (double clic, retour arrière, StrictMode)
 *   renvoie la carte déjà créée (`alreadyClaimed: true`), jamais un doublon.
 *   La « réservation » est écrite dans `design.essai.claimed` par
 *   compare-and-swap AVANT l'insert : deux requêtes simultanées ne peuvent pas
 *   créer deux copies.
 * - Gating identique à la création de carte (`requirePlan("extra_cards")`).
 * - La copie est propre : `design` sans la clé `essai`, logo recopié dans le
 *   dossier du commerce (la carte ne dépend plus des fichiers de la démo).
 * - Le commerce est complété s'il est encore « vierge » (logo, catégorie,
 *   nom générique) et l'onboarding est marqué terminé : le commerçant arrive
 *   directement sur SA carte.
 */

const LOGO_BUCKET = "card-assets";
/** Au-delà, une réservation sans carte créée est considérée comme abandonnée. */
const RESERVATION_GRACE_MS = 60_000;
/** Attente max d'une copie en cours de création par une requête concurrente. */
const CONCURRENT_WAIT_MS = 6_000;

/**
 * Nom posé par `handle_new_user` quand l'inscription ne fournit pas de nom
 * (Google OAuth notamment) — cf. supabase/migrations/010_extended_trial.sql.
 */
const GENERIC_BUSINESS_NAMES = new Set(["mon commerce", "commerce", "ma boutique"]);

type BusinessCategoryLabel = (typeof BUSINESS_CATEGORIES)[number];

/** Métier détecté → libellé du sélecteur « Catégorie » de /settings. */
const CATEGORY_LABELS: Record<EssaiCategory, BusinessCategoryLabel> = {
  kebab: "Kebab",
  burger: "Fast-food",
  tacos: "Fast-food",
  chicken: "Fast-food",
  pizza: "Pizzeria",
  sushi: "Sushi",
  restaurant: "Restaurant",
  boulangerie: "Boulangerie",
  patisserie: "Pâtisserie",
  cafe: "Café / Salon de thé",
  bar: "Bar",
  glacier: "Glacier",
  coiffeur: "Coiffeur",
  barbier: "Barbier",
  beaute: "Institut de beauté",
  onglerie: "Institut de beauté",
  fleuriste: "Fleuriste",
  epicerie: "Épicerie",
  boucherie: "Boucherie / Charcuterie",
  pressing: "Pressing / Laverie",
  autre: "Autre",
};

function isGenericBusinessName(name: string | null | undefined): boolean {
  const n = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return n === "" || GENERIC_BUSINESS_NAMES.has(n);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cardExists(
  admin: SupabaseClient,
  cardId: string,
  businessId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(`[essai/claim] lecture de la copie : ${error.message}`);
  return Boolean(data);
}

/** Attend (borné) qu'une copie créée par une requête concurrente apparaisse. */
async function waitForCard(
  admin: SupabaseClient,
  cardId: string,
  businessId: string,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await cardExists(admin, cardId, businessId)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(400);
  }
}

/** `essai/<cardId>/logo.png` depuis l'URL publique du bucket, sinon null. */
function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${LOGO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  } catch {
    return null;
  }
}

/**
 * Recopie le logo de la démo dans le dossier du commerce (même convention
 * que /api/upload). En cas d'échec on garde l'URL de la démo : la carte
 * reste fonctionnelle, simplement liée au fichier d'origine.
 */
async function copyLogo(
  admin: SupabaseClient,
  logoUrl: string | null,
  businessId: string
): Promise<{ url: string | null; path: string | null }> {
  const from = storagePathFromPublicUrl(logoUrl);
  if (!from) return { url: logoUrl, path: null };
  const to = `${businessId}/logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await admin.storage.from(LOGO_BUCKET).copy(from, to);
  if (error) {
    console.warn("[essai/claim] copie du logo impossible, URL de la démo conservée :", error.message);
    return { url: logoUrl, path: null };
  }
  const {
    data: { publicUrl },
  } = admin.storage.from(LOGO_BUCKET).getPublicUrl(to);
  return { url: publicUrl, path: to };
}

/** Résultat « déjà gardée » si la copie de ce commerce existe (ou arrive). */
async function existingClaimFor(
  admin: SupabaseClient,
  loaded: LoadedEssai,
  businessId: string
): Promise<EssaiClaimResponse | null> {
  const claimed = loaded.meta.claimed;
  if (!claimed || claimed.business_id !== businessId) return null;
  const age = Date.now() - new Date(claimed.at).getTime();
  const waitMs = age >= 0 && age < RESERVATION_GRACE_MS ? CONCURRENT_WAIT_MS : 0;
  if (await waitForCard(admin, claimed.card_id, businessId, waitMs)) {
    return { ok: true, cardId: claimed.card_id, alreadyClaimed: true };
  }
  // Carte supprimée depuis par le commerçant (ou réservation abandonnée) :
  // on autorise une nouvelle copie.
  return null;
}

export async function claimEssaiCard(args: {
  token: string;
  userId: string;
}): Promise<EssaiClaimResponse> {
  const loaded = await loadEssai(args.token);
  if (!loaded) throw new EssaiError(ESSAI_NOT_FOUND_ERROR, 404);

  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("business_id, role")
    .eq("id", args.userId)
    .maybeSingle();
  if (profileErr) throw new Error(`[essai/claim] lecture du profil : ${profileErr.message}`);
  if (!profile) {
    throw new EssaiError("Votre compte est introuvable. Reconnectez-vous puis réessayez.", 404);
  }
  if (profile.role === "employee") {
    throw new EssaiError(
      "Seul le gérant du commerce peut garder cette carte. Connectez-vous avec son compte.",
      403
    );
  }
  const businessId = profile.business_id as string | null;
  if (!businessId) {
    throw new EssaiError(
      "Aucun commerce n'est rattaché à votre compte. Écrivez-nous sur WhatsApp, on s'en occupe.",
      409
    );
  }
  if (businessId === (await findEssaiBusinessId(admin))) {
    throw new EssaiError("Ce compte ne peut pas garder de carte d'essai.", 403);
  }

  // 1. Déjà gardée par ce commerce → idempotence.
  const already = await existingClaimFor(admin, loaded, businessId);
  if (already) return already;
  if (loaded.meta.claimed && loaded.meta.claimed.business_id !== businessId) {
    throw new EssaiError(
      "Cette carte a déjà été gardée par un autre compte. Créez la vôtre en 30 secondes sur la page Essai.",
      409
    );
  }
  /** Réservation périmée (copie supprimée) que l'on a le droit de remplacer. */
  const staleCardId = loaded.meta.claimed?.card_id ?? null;

  // 2. Gating : mêmes règles que la création d'une carte depuis le dashboard.
  const { data: business, error: businessErr } = await admin
    .from("businesses")
    .select(
      "id, name, logo_url, category, onboarding_completed_at, subscription_status, subscription_plan, trial_ends_at"
    )
    .eq("id", businessId)
    .single();
  if (businessErr || !business) {
    throw new Error(`[essai/claim] lecture du commerce : ${businessErr?.message ?? "introuvable"}`);
  }
  const { count: cardsCount, error: countErr } = await admin
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (countErr) throw new Error(`[essai/claim] comptage des cartes : ${countErr.message}`);

  const gate = requirePlan(business as BusinessBillingState, "extra_cards", {
    currentCardsCount: cardsCount ?? 0,
  });
  if (!gate.ok) throw new EssaiError(gate.message, 402);

  // 3. Réservation atomique dans la meta de l'essai.
  const newCardId = randomUUID();
  const reservation = await updateEssaiMeta(admin, loaded.card.id, (meta) => {
    if (meta.claimed && meta.claimed.card_id !== staleCardId) return null;
    return {
      ...meta,
      claimed: { business_id: businessId, card_id: newCardId, at: new Date().toISOString() },
    };
  });
  if (!reservation.written) {
    // Une requête concurrente a réservé juste avant nous.
    const winner = reservation.meta.claimed;
    if (winner && winner.business_id === businessId) {
      await waitForCard(admin, winner.card_id, businessId, CONCURRENT_WAIT_MS);
      return { ok: true, cardId: winner.card_id, alreadyClaimed: true };
    }
    throw new EssaiError("Cette carte a déjà été gardée par un autre compte.", 409);
  }

  // 4. Copie de la carte.
  const source = loaded.card;
  const design = Object.fromEntries(
    Object.entries(source.design).filter(([key]) => key !== "essai")
  ) as Record<string, unknown>;
  const logo = await copyLogo(admin, source.design.logo_url, businessId);
  design.logo_url = logo.url;

  // Le lien d'avis trouvé à l'analyse est pré-rempli (désactivé) dans les
  // réglages « Demande d'avis Google » : le commerçant n'a qu'à l'activer.
  const reviewUrl = loaded.meta.review_url;
  const autoPushSettings =
    reviewUrl && isValidReviewUrl(reviewUrl)
      ? {
          google_review: {
            enabled: false,
            url: reviewUrl,
            message: "",
            delay_minutes: REVIEW_DEFAULT_DELAY,
          },
        }
      : {};

  const { error: insertErr } = await admin.from("cards").insert({
    id: newCardId,
    business_id: businessId,
    name: source.name,
    card_type: "stamp",
    status: "active",
    barcode_type: source.barcode_type ?? "qr",
    stamp_count: source.stamp_count,
    reward_text: source.reward_text,
    expiration_type: "unlimited",
    wallet_business_name: source.wallet_business_name ?? source.name,
    design,
    auto_push_settings: autoPushSettings,
  });

  if (insertErr) {
    // Annule la réservation et le logo recopié pour permettre un nouvel essai.
    try {
      await updateEssaiMeta(admin, loaded.card.id, (meta) =>
        meta.claimed?.card_id === newCardId ? { ...meta, claimed: null } : null
      );
    } catch (rollbackErr) {
      console.error("[essai/claim] annulation de la réservation échouée :", rollbackErr);
    }
    if (logo.path) {
      const { error: rmErr } = await admin.storage.from(LOGO_BUCKET).remove([logo.path]);
      if (rmErr) console.error("[essai/claim] suppression du logo recopié échouée :", rmErr.message);
    }
    throw new Error(`[essai/claim] insert de la copie : ${insertErr.message}`);
  }

  // 5. Commerce complété s'il est encore vierge + onboarding terminé.
  const patch: Record<string, unknown> = {};
  if (!business.logo_url && logo.url) patch.logo_url = logo.url;
  if (!business.category) patch.category = CATEGORY_LABELS[loaded.meta.category];
  if (isGenericBusinessName(business.name as string | null)) patch.name = source.name;
  if (!business.onboarding_completed_at) patch.onboarding_completed_at = new Date().toISOString();
  if (Object.keys(patch).length > 0) {
    const { error: patchErr } = await admin.from("businesses").update(patch).eq("id", businessId);
    // La carte est créée : un échec ici ne doit pas faire échouer la reprise.
    if (patchErr) console.error("[essai/claim] mise à jour du commerce échouée :", patchErr.message);
  }

  return { ok: true, cardId: newCardId, alreadyClaimed: false };
}
