import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLoyaltyObject } from "@/lib/google-wallet";
import { requirePlan, type BusinessBillingState } from "@/lib/billing";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Segment = "all" | "inactive_30d" | "has_reward" | "never_redeemed";

const VALID_SEGMENTS: Segment[] = [
  "all",
  "inactive_30d",
  "has_reward",
  "never_redeemed",
];

const MAX_MESSAGE_LENGTH = 200;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface InstanceRow {
  id: string;
  token: string;
  stamps_collected: number;
  rewards_available: number;
  rewards_redeemed: number;
  last_scanned_at: string | null;
  status: string;
  created_at: string;
}

function filterBySegment(
  instances: InstanceRow[],
  segment: Segment
): InstanceRow[] {
  const now = Date.now();
  return instances.filter((i) => {
    if (i.status !== "active") return false;
    switch (segment) {
      case "all":
        return true;
      case "inactive_30d": {
        const lastSeen = i.last_scanned_at
          ? new Date(i.last_scanned_at).getTime()
          : new Date(i.created_at).getTime();
        return now - lastSeen >= THIRTY_DAYS_MS;
      }
      case "has_reward":
        return (i.rewards_available ?? 0) > 0;
      case "never_redeemed":
        return (i.rewards_redeemed ?? 0) === 0;
    }
  });
}

export async function POST(request: Request) {
  // Rate limit : un commerçant ne devrait pas envoyer 50 campagnes par minute.
  const limited = await rateLimit(request, {
    limit: 5,
    windowMs: 60_000,
    key: "campaigns:send",
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, business_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 400 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("subscription_status, subscription_plan, trial_ends_at")
      .eq("id", profile.business_id)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: "Commerce introuvable" },
        { status: 404 }
      );
    }

    const gate = requirePlan(business as BusinessBillingState, "campaigns");
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.message,
          requiredPlan: gate.requiredPlan,
        },
        { status: 402 }
      );
    }

    const body = await request.json();
    const { cardId, message, segment } = body as {
      cardId?: string;
      message?: string;
      segment?: string;
    };

    if (!cardId || typeof cardId !== "string") {
      return NextResponse.json(
        { error: "cardId requis" },
        { status: 422 }
      );
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Le message est requis" },
        { status: 422 }
      );
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères` },
        { status: 422 }
      );
    }
    if (!segment || !VALID_SEGMENTS.includes(segment as Segment)) {
      return NextResponse.json(
        { error: "Segment invalide" },
        { status: 422 }
      );
    }
    const seg = segment as Segment;

    // Vérifie que la carte appartient bien au commerce.
    const { data: card } = await supabase
      .from("cards")
      .select("id, business_id, stamp_count")
      .eq("id", cardId)
      .eq("business_id", profile.business_id)
      .single();

    if (!card) {
      return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    }

    // Charge les instances (admin client : on a besoin de toutes les infos
    // pour filtrer correctement, peu importe le RLS).
    const admin = createAdminClient();
    const { data: instances } = await admin
      .from("card_instances")
      .select(
        "id, token, stamps_collected, rewards_available, rewards_redeemed, last_scanned_at, status, created_at"
      )
      .eq("card_id", cardId);

    const targets = filterBySegment(
      (instances ?? []) as InstanceRow[],
      seg
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

    // Push wallet en parallèle (best effort, on log les échecs).
    let pushed = 0;
    if (targets.length > 0) {
      const results = await Promise.allSettled(
        targets.map((t) =>
          syncLoyaltyObject(
            t.token,
            t.stamps_collected,
            t.rewards_available,
            appUrl,
            message,
            card.stamp_count
          )
        )
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.ok) pushed++;
      }
    }

    // Insère la campagne dans la DB (RLS via supabase auth).
    const { data: inserted, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        card_id: cardId,
        business_id: profile.business_id,
        message: message.trim(),
        segment: seg,
        recipients_count: targets.length,
        created_by: profile.id,
      })
      .select("id, sent_at")
      .single();

    if (insertError) {
      console.error("[campaigns] insert error:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la campagne" },
        { status: 500 }
      );
    }

    // TODO Apple Wallet phase 2 : APNs push live nécessite un certificat APNs
    // séparé du Pass Type cert. En phase 1, le message s'affichera dans le
    // back-of-card lorsque l'utilisateur ouvrira la carte (cf. backFields).

    return NextResponse.json({
      id: inserted.id,
      sent_at: inserted.sent_at,
      recipients: targets.length,
      pushed_to_google: pushed,
    });
  } catch (err) {
    console.error("POST /api/campaigns error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 400 });
    }

    const url = new URL(request.url);
    const cardId = url.searchParams.get("cardId");

    let query = supabase
      .from("campaigns")
      .select("id, card_id, message, segment, recipients_count, sent_at")
      .eq("business_id", profile.business_id)
      .order("sent_at", { ascending: false })
      .limit(50);

    if (cardId) query = query.eq("card_id", cardId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data ?? [] });
  } catch (err) {
    console.error("GET /api/campaigns error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
