import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLoyaltyObject } from "@/lib/google-wallet";
import { pushAppleWalletUpdate } from "@/lib/apple-wallet-push";
import { isLockedOut, type BusinessBillingState } from "@/lib/billing";
import {
  activeReviewUrl,
  buildReviewMessage,
  readGoogleReview,
} from "@/lib/google-review";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Fenêtre de rattrapage : si un tick du cron saute, on reprend les scans
 * jusqu'à 1 h en arrière. Au-delà, demander un avis n'a plus de sens.
 */
const CATCH_UP_MS = 60 * 60 * 1000;

/**
 * Cron minute — demande d'avis Google automatique après passage.
 *
 * Pour chaque carte active avec `auto_push_settings.google_review.enabled`,
 * on cible les clients scannés il y a `delay_minutes` (3 min par défaut) et
 * on leur envoie une notification wallet avec le lien vers la fiche Google.
 *
 * - Une seule demande par client et par carte : le log `auto_push_log`
 *   (trigger `google_review`) est inséré AVANT l'envoi et un index unique
 *   partiel (migration 014) fait échouer le doublon → on saute le client.
 * - Apple : même mécanique que les campagnes (`last_campaign_message` +
 *   APNs → notif lockscreen avec le texte exact).
 * - Google : message TEXT_AND_NOTIFY + lien "Laisser un avis" sur la carte.
 * - Tous les plans, tant que le commerce n'est pas bloqué (essai expiré
 *   sans abonnement).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
  const nowMs = Date.now();

  const { data: cards, error: cardsErr } = await supabase
    .from("cards")
    .select("id, business_id, card_type, stamp_count, design, auto_push_settings")
    .eq("status", "active")
    .eq("auto_push_settings->google_review->>enabled", "true");

  if (cardsErr) {
    console.error("[cron/review-requests] cards query failed:", cardsErr);
    return NextResponse.json({ error: cardsErr.message }, { status: 500 });
  }
  if (!cards || cards.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  const businessIds = [...new Set(cards.map((c) => c.business_id as string))];
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, is_active, subscription_status, subscription_plan, trial_ends_at")
    .in("id", businessIds);
  const businessById = new Map((businesses ?? []).map((b) => [b.id as string, b]));

  let sent = 0;
  let skipped = 0;
  let claimFailedLogged = false;

  for (const card of cards) {
    const reviewUrl = activeReviewUrl(card.auto_push_settings);
    const settings = readGoogleReview(card.auto_push_settings);
    if (!reviewUrl || !settings) continue;

    const biz = businessById.get(card.business_id as string);
    if (!biz || biz.is_active === false) continue;
    if (isLockedOut(biz as unknown as BusinessBillingState)) continue;

    const delayMs = settings.delay_minutes * 60 * 1000;
    const windowEnd = new Date(nowMs - delayMs).toISOString();
    const windowStart = new Date(nowMs - delayMs - CATCH_UP_MS).toISOString();

    const { data: instances } = await supabase
      .from("card_instances")
      .select("id, token, stamps_collected, rewards_available, clients(first_name)")
      .eq("card_id", card.id)
      .eq("status", "active")
      .gte("last_scanned_at", windowStart)
      .lte("last_scanned_at", windowEnd);

    if (!instances || instances.length === 0) continue;

    const { data: alreadyAsked } = await supabase
      .from("auto_push_log")
      .select("card_instance_id")
      .eq("trigger", "google_review")
      .in(
        "card_instance_id",
        instances.map((i) => i.id)
      );
    const asked = new Set((alreadyAsked ?? []).map((l) => l.card_instance_id));

    // CardKind + label_stamps : à propager à syncLoyaltyObject pour ne
    // pas pousser un compteur sur des cartes Discount/Membership.
    const ck = card.card_type as string | null;
    const cardKind: "stamp" | "cashback" | "discount" | "membership" =
      ck === "cashback" || ck === "discount" || ck === "membership" ? ck : "stamp";
    const design = (card.design ?? {}) as Record<string, unknown>;
    const labelStamps =
      typeof design.label_stamps === "string" ? design.label_stamps : null;

    for (const inst of instances) {
      if (asked.has(inst.id)) continue;

      const { error: claimErr } = await supabase.from("auto_push_log").insert({
        business_id: card.business_id,
        card_instance_id: inst.id,
        trigger: "google_review",
      });
      if (claimErr) {
        skipped++;
        // 23505 = doublon (autre exécution du cron) → normal. Le reste
        // (ex. 23514 si la migration 014 n'est pas appliquée) est loggé
        // une fois par exécution.
        if (claimErr.code !== "23505" && !claimFailedLogged) {
          console.warn("[cron/review-requests] claim failed:", claimErr.message);
          claimFailedLogged = true;
        }
        continue;
      }

      const client = inst.clients as unknown as { first_name: string | null } | null;
      const message = buildReviewMessage(
        settings.message,
        reviewUrl,
        client?.first_name
      );

      // Stamp AVANT le push Apple : iOS refetch le pass et doit voir la
      // nouvelle value du champ "Annonce" pour afficher la notif riche.
      await supabase
        .from("card_instances")
        .update({
          last_campaign_message: message,
          last_campaign_at: new Date().toISOString(),
        })
        .eq("id", inst.id);

      await Promise.allSettled([
        syncLoyaltyObject(
          inst.token,
          inst.stamps_collected,
          inst.rewards_available,
          appUrl,
          message,
          card.stamp_count as number,
          labelStamps,
          cardKind,
          {
            header: "Votre avis compte ⭐",
            notify: true,
            links: [
              {
                uri: `${appUrl}/c/${card.id}/status/${inst.token}`,
                description: "Voir ma carte",
                id: "open-card",
              },
              {
                uri: reviewUrl,
                description: "Laisser un avis Google ⭐",
                id: "google-review",
              },
            ],
          }
        ),
        pushAppleWalletUpdate(inst.token),
      ]);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
