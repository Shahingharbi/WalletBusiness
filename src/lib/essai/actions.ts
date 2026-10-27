import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLoyaltyObject } from "@/lib/google-wallet";
import { pushAppleWalletUpdate } from "@/lib/apple-wallet-push";
import {
  REVIEW_DEFAULT_MESSAGE,
  buildReviewMessage,
  isValidReviewUrl,
} from "@/lib/google-review";
import { EssaiError, ESSAI_NOT_FOUND_ERROR } from "@/lib/essai/errors";
import {
  ESSAI_TTL_DAYS,
  loadEssai,
  updateEssaiMeta,
  type LoadedEssai,
} from "@/lib/essai/load";
import type { EssaiActionResponse, EssaiActionType } from "@/lib/essai/types";

export { EssaiError } from "@/lib/essai/errors";

/**
 * « Testez-la en direct » : le prospect déclenche sur SA carte, depuis la
 * page /essai/<token>, les trois moments forts du produit :
 *
 *  - stamp  : un tampon (+ passage à la récompense quand la carte est pleine)
 *             → la grille se met à jour dans le wallet ;
 *  - promo  : une notification promo (texte généré pour son métier) ;
 *  - review : la demande d'avis Google avec le lien de sa fiche.
 *
 * Les envois wallet reprennent EXACTEMENT la mécanique de production
 * (cf. app/api/cron/review-requests) pour que la démo prouve le vrai
 * produit : Apple = `last_campaign_message` stampé AVANT l'APNs (iOS refetch
 * le pass et affiche le texte sur l'écran verrouillé) ; Google = PATCH du
 * loyaltyObject (+ message TEXT_AND_NOTIFY pour promo / avis).
 *
 * Volontairement, aucune ligne `transactions` n'est écrite : les essais ne
 * doivent pas gonfler les statistiques de la plateforme (/admin).
 */

export const ESSAI_ACTION_TYPES: readonly EssaiActionType[] = ["stamp", "promo", "review"];

export function isEssaiActionType(value: unknown): value is EssaiActionType {
  return (ESSAI_ACTION_TYPES as readonly unknown[]).includes(value);
}

const PROMO_HEADER = "Offre spéciale 🎁";
const REVIEW_HEADER = "Votre avis compte ⭐";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
}

/** Lien « Voir ma carte » identique à celui posé à la création du pass Google. */
function openCardLink(loaded: LoadedEssai) {
  return {
    uri: `${appUrl()}/c/${loaded.card.id}/status/${loaded.instance.token}`,
    description: "Voir ma carte",
    id: "open-card",
  };
}

/** Ville extraite d'une adresse « rue, 75011 Paris » (best-effort). */
function cityFromAddress(address: string | null): string | null {
  if (!address) return null;
  const withZip = /\b\d{5}\s+([^,\d][^,]*)/.exec(address);
  if (withZip) return withZip[1].trim();
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^france$/i.test(s));
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/**
 * Lien d'avis : celui trouvé à l'analyse (fiche Google / writereview) s'il
 * est exploitable, sinon une recherche Google « <nom> <ville> avis » qui
 * affiche la fiche du commerce avec son bouton « Écrire un avis ».
 */
export function essaiReviewUrl(loaded: LoadedEssai): string {
  const found = loaded.meta.review_url;
  if (found && isValidReviewUrl(found)) return found;
  const city = cityFromAddress(loaded.meta.address);
  const query = [loaded.card.name, city, "avis"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Évite de répéter le même avertissement à chaque action (logs lisibles). */
let campaignColumnWarned = false;

/**
 * Stampe le message sur la carte client AVANT le push Apple : iOS refetch le
 * pass et doit y voir la nouvelle valeur du champ « Annonce » pour afficher
 * la notification avec le texte exact. Un échec n'empêche pas l'envoi Google.
 */
async function stampCampaignMessage(
  admin: SupabaseClient,
  instanceId: string,
  message: string
): Promise<void> {
  const { error } = await admin
    .from("card_instances")
    .update({
      last_campaign_message: message,
      last_campaign_at: new Date().toISOString(),
    })
    .eq("id", instanceId);
  if (error && !campaignColumnWarned) {
    campaignColumnWarned = true;
    // Ex. migration 013 non appliquée : la notif Apple ne portera pas le texte.
    console.warn("[essai/action] last_campaign_message non enregistré :", error.message);
  }
}

/**
 * +1 tampon, atomique sans RPC : compare-and-swap sur l'état lu. On n'utilise
 * pas la RPC `add_stamp` car sa déduplication de 30 s (anti double scan en
 * caisse) bloquerait une démo où l'on enchaîne les tampons.
 */
async function addStamp(
  admin: SupabaseClient,
  loaded: LoadedEssai
): Promise<{ stamps: number; rewards: number }> {
  const stampCount = loaded.card.stamp_count;
  let current = {
    stamps: loaded.instance.stamps_collected,
    rewards: loaded.instance.rewards_available,
    total: loaded.instance.total_stamps_ever,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    let stamps = current.stamps + 1;
    let rewards = current.rewards;
    // Même règle que add_stamp : carte pleine → récompense + grille remise à zéro.
    if (stamps >= stampCount) {
      stamps -= stampCount;
      rewards += 1;
    }

    const { data, error } = await admin
      .from("card_instances")
      .update({
        stamps_collected: stamps,
        rewards_available: rewards,
        total_stamps_ever: current.total + 1,
        last_scanned_at: new Date().toISOString(),
      })
      .eq("id", loaded.instance.id)
      .eq("stamps_collected", current.stamps)
      .eq("rewards_available", current.rewards)
      .select("id");
    if (error) throw new Error(`[essai/action] tampon : ${error.message}`);
    if (data && data.length > 0) return { stamps, rewards };

    // Un autre tampon est passé entre-temps : on relit et on recommence.
    const { data: fresh, error: freshErr } = await admin
      .from("card_instances")
      .select("stamps_collected, rewards_available, total_stamps_ever")
      .eq("id", loaded.instance.id)
      .single();
    if (freshErr || !fresh) {
      throw new Error(`[essai/action] relecture : ${freshErr?.message ?? "introuvable"}`);
    }
    current = {
      stamps: fresh.stamps_collected as number,
      rewards: fresh.rewards_available as number,
      total: fresh.total_stamps_ever as number,
    };
  }
  throw new EssaiError("Trop de tampons en même temps. Réessayez dans un instant.", 409);
}

/** Compteur d'utilisation (admin) — analytique, ne doit jamais casser la démo. */
async function countAction(
  admin: SupabaseClient,
  cardId: string,
  type: EssaiActionType
): Promise<void> {
  try {
    await updateEssaiMeta(admin, cardId, (meta) => ({
      ...meta,
      actions: { ...meta.actions, [type]: meta.actions[type] + 1 },
    }));
  } catch (err) {
    console.error("[essai/action] compteur non mis à jour :", err);
  }
}

/**
 * Exécute une action de démo sur la carte d'essai `token`.
 * Lève {@link EssaiError} (404 / 410 / 409 / 422) avec un message en français.
 */
export async function runEssaiAction(
  token: string,
  type: EssaiActionType
): Promise<EssaiActionResponse> {
  if (!isEssaiActionType(type)) {
    throw new EssaiError("Action inconnue.", 422);
  }

  const loaded = await loadEssai(token);
  if (!loaded) throw new EssaiError(ESSAI_NOT_FOUND_ERROR, 404);
  if (loaded.card.status !== "active" || loaded.instance.status !== "active") {
    throw new EssaiError("Cette carte n'est plus active.", 410);
  }
  if (loaded.expired) {
    throw new EssaiError(
      `Cette démo a expiré au bout de ${ESSAI_TTL_DAYS} jours. Vous pouvez toujours garder votre carte ou en créer une nouvelle.`,
      410
    );
  }

  const admin = createAdminClient();
  const { card, instance } = loaded;
  const labelStamps = card.design.label_stamps || null;
  const url = appUrl();

  let stamps = instance.stamps_collected;
  let rewards = instance.rewards_available;
  let message: string | null = null;
  let pushes: Promise<unknown>[];

  if (type === "stamp") {
    ({ stamps, rewards } = await addStamp(admin, loaded));
    // Tampon = mise à jour silencieuse (comme un vrai passage en caisse).
    pushes = [
      syncLoyaltyObject(
        instance.token,
        stamps,
        rewards,
        url,
        undefined,
        card.stamp_count,
        labelStamps,
        "stamp"
      ),
      pushAppleWalletUpdate(instance.token),
    ];
  } else {
    let header: string;
    let links: { uri: string; description: string; id: string }[];

    if (type === "promo") {
      message =
        loaded.meta.promo_message.trim() ||
        `🔥 ${card.name} : une offre spéciale vous attend aujourd'hui !`;
      header = PROMO_HEADER;
      links = [openCardLink(loaded)];
    } else {
      const reviewUrl = essaiReviewUrl(loaded);
      message = buildReviewMessage(REVIEW_DEFAULT_MESSAGE, reviewUrl, null);
      header = REVIEW_HEADER;
      links = [
        openCardLink(loaded),
        { uri: reviewUrl, description: "Laisser un avis Google ⭐", id: "google-review" },
      ];
    }

    await stampCampaignMessage(admin, instance.id, message);
    pushes = [
      syncLoyaltyObject(
        instance.token,
        stamps,
        rewards,
        url,
        message,
        card.stamp_count,
        labelStamps,
        "stamp",
        { header, notify: true, links }
      ),
      pushAppleWalletUpdate(instance.token),
    ];
  }

  // On attend les envois AVANT de répondre (« Regardez votre téléphone » doit
  // être vrai) ; chaque envoi est borné (timeout Google 3 s, APNs HTTP/2) et
  // un échec wallet ne fait pas échouer la démo.
  const [, results] = await Promise.all([
    countAction(admin, card.id, type),
    Promise.allSettled(pushes),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("[essai/action] envoi wallet échoué :", r.reason);
  }

  return {
    ok: true,
    type,
    stamps,
    stampCount: card.stamp_count,
    rewards,
    message,
  };
}
