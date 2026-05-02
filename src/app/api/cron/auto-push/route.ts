import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLoyaltyObject } from "@/lib/google-wallet";
import { effectivePlan, type BusinessBillingState } from "@/lib/billing";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron quotidien (10h Europe/Paris) — Boomerangme-style auto-push.
 *
 * 3 triggers évalués pour chaque card_instance ACTIVE des plans Pro/Business :
 *
 *  1. inactive_30d   : dernière transaction `stamp_add` > 30j -> "On vous a manqué"
 *  2. near_reward_80 : stamps_collected >= 0.8 * stamp_count -> "Plus que N tampons"
 *  3. birthday       : clients.birthday = aujourd'hui (mois+jour)
 *
 * Idempotent via `auto_push_log` : un trigger ne re-pousse pas avant son
 * cooldown propre (30j / 7j / 365j).
 *
 * Apple Wallet : le push live nécessite APNs (pas implémenté). Pour l'instant
 * seul Google Wallet reçoit la notif. Côté Apple le message apparaîtra en
 * back-of-card à la prochaine ouverture.
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
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Charge tous les businesses Pro/Business (les seuls qui ont accès aux
  // pushes wallet — le gating est aligné sur la feature `campaigns`).
  const { data: businesses, error: bizErr } = await supabase
    .from("businesses")
    .select("id, name, subscription_status, subscription_plan, trial_ends_at")
    .eq("is_active", true);

  if (bizErr) {
    console.error("[cron/auto-push] businesses query failed:", bizErr);
    return NextResponse.json({ error: bizErr.message }, { status: 500 });
  }

  let totalInactivePushed = 0;
  let totalNearRewardPushed = 0;
  let totalBirthdayPushed = 0;
  let businessesProcessed = 0;

  for (const biz of businesses ?? []) {
    const billing = biz as unknown as BusinessBillingState & { id: string; name: string };
    const plan = effectivePlan(billing);
    if (plan === "starter") continue; // gating : auto-push = Pro+
    businessesProcessed++;

    // Toutes les cartes du business pour récupérer stamp_count + reward_text
    // + auto_push_settings.
    const { data: cards } = await supabase
      .from("cards")
      .select("id, name, stamp_count, reward_text, auto_push_settings")
      .eq("business_id", biz.id)
      .eq("status", "active");

    if (!cards || cards.length === 0) continue;

    // Toutes les instances actives + leurs derniers logs auto-push.
    const cardIds = cards.map((c) => c.id);
    const { data: instances } = await supabase
      .from("card_instances")
      .select(
        "id, token, stamps_collected, rewards_available, last_scanned_at, status, card_id, client_id, clients(birthday, first_name)"
      )
      .in("card_id", cardIds)
      .eq("status", "active");

    if (!instances || instances.length === 0) continue;

    const instanceIds = instances.map((i) => i.id);
    const { data: logs } = await supabase
      .from("auto_push_log")
      .select("card_instance_id, trigger, sent_at")
      .in("card_instance_id", instanceIds)
      .gte("sent_at", oneYearAgo);

    const lastByKey = new Map<string, string>(); // `${instId}::${trigger}` -> sent_at
    for (const l of logs ?? []) {
      const key = `${l.card_instance_id}::${l.trigger}`;
      const prev = lastByKey.get(key);
      if (!prev || l.sent_at > prev) lastByKey.set(key, l.sent_at);
    }

    const cardById = new Map(cards.map((c) => [c.id, c]));

    for (const inst of instances) {
      const card = cardById.get(inst.card_id);
      if (!card) continue;
      const settings = (card.auto_push_settings ?? {}) as {
        inactive_30d?: { enabled?: boolean; message?: string };
        near_reward_80?: { enabled?: boolean; message?: string };
        birthday?: { enabled?: boolean; message?: string };
      };

      const lastScanIso = inst.last_scanned_at;
      const client = inst.clients as unknown as {
        birthday: string | null;
        first_name: string | null;
      } | null;

      // ── Trigger 1: inactive_30d ─────────────────────────────────
      // Default ON for Pro+. Cooldown : 30j.
      if (settings.inactive_30d?.enabled !== false) {
        const lastSent = lastByKey.get(`${inst.id}::inactive_30d`);
        const stale = !lastSent || lastSent < thirtyDaysAgo;
        const inactive =
          (lastScanIso ?? "") < thirtyDaysAgo && stale && (lastScanIso ?? "") !== "";
        if (inactive) {
          const tmpl =
            settings.inactive_30d?.message?.trim() ||
            `On vous a manqué ! Revenez profiter de ${card.reward_text}`;
          const msg = renderMessage(tmpl, { reward: card.reward_text, name: client?.first_name });
          const r = await syncLoyaltyObject(
            inst.token,
            inst.stamps_collected,
            inst.rewards_available,
            appUrl,
            msg,
            card.stamp_count
          );
          if (r.ok) {
            totalInactivePushed++;
            await supabase.from("auto_push_log").insert({
              business_id: biz.id,
              card_instance_id: inst.id,
              trigger: "inactive_30d",
            });
          }
        }
      }

      // ── Trigger 2: near_reward_80 ───────────────────────────────
      // Cooldown : 7j (sinon spam si stamps_collected stagne).
      if (settings.near_reward_80?.enabled !== false) {
        const lastSent = lastByKey.get(`${inst.id}::near_reward_80`);
        const stale = !lastSent || lastSent < sevenDaysAgo;
        const ratio =
          card.stamp_count > 0 ? inst.stamps_collected / card.stamp_count : 0;
        if (
          stale &&
          ratio >= 0.8 &&
          inst.stamps_collected < card.stamp_count // pas déjà rempli
        ) {
          const remaining = Math.max(0, card.stamp_count - inst.stamps_collected);
          const tmpl =
            settings.near_reward_80?.message?.trim() ||
            `Plus que ${remaining} tampon${remaining > 1 ? "s" : ""} pour gagner ${card.reward_text} !`;
          const msg = renderMessage(tmpl, {
            remaining: String(remaining),
            reward: card.reward_text,
            name: client?.first_name,
          });
          const r = await syncLoyaltyObject(
            inst.token,
            inst.stamps_collected,
            inst.rewards_available,
            appUrl,
            msg,
            card.stamp_count
          );
          if (r.ok) {
            totalNearRewardPushed++;
            await supabase.from("auto_push_log").insert({
              business_id: biz.id,
              card_instance_id: inst.id,
              trigger: "near_reward_80",
            });
          }
        }
      }

      // ── Trigger 3: birthday ────────────────────────────────────
      // Cooldown : 365j.
      if (settings.birthday?.enabled !== false && client?.birthday) {
        const bd = client.birthday; // YYYY-MM-DD
        const todayMonthDay = today.slice(5); // MM-DD
        const bdMonthDay = bd.slice(5);
        if (bdMonthDay === todayMonthDay) {
          const lastSent = lastByKey.get(`${inst.id}::birthday`);
          const stale = !lastSent || lastSent < oneYearAgo;
          if (stale) {
            const tmpl =
              settings.birthday?.message?.trim() ||
              `Joyeux anniversaire ${client.first_name ?? ""} ! Voici une récompense rien que pour vous.`;
            const msg = renderMessage(tmpl, {
              name: client.first_name,
              reward: card.reward_text,
            });
            const r = await syncLoyaltyObject(
              inst.token,
              inst.stamps_collected,
              inst.rewards_available,
              appUrl,
              msg,
              card.stamp_count
            );
            if (r.ok) {
              totalBirthdayPushed++;
              await supabase.from("auto_push_log").insert({
                business_id: biz.id,
                card_instance_id: inst.id,
                trigger: "birthday",
              });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    businesses_processed: businessesProcessed,
    inactive_30d_pushed: totalInactivePushed,
    near_reward_80_pushed: totalNearRewardPushed,
    birthday_pushed: totalBirthdayPushed,
  });
}

/**
 * Templates simples : remplace `{name}`, `{reward}`, `{remaining}`.
 * Si une variable est absente du contexte, on remplace par la chaîne vide.
 */
function renderMessage(
  template: string,
  ctx: { name?: string | null; reward?: string | null; remaining?: string }
): string {
  return template
    .replace(/\{name\}/gi, ctx.name?.trim() ?? "")
    .replace(/\{reward\}/gi, ctx.reward ?? "")
    .replace(/\{remaining\}/gi, ctx.remaining ?? "")
    .trim()
    .slice(0, 200);
}
