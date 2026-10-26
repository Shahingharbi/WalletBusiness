import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requirePlan,
  type BusinessBillingState,
} from "@/lib/billing";
import {
  sanitizeGoogleReview,
  type GoogleReviewSettings,
} from "@/lib/google-review";

export const runtime = "nodejs";

export interface AutoPushTriggerSettings {
  enabled: boolean;
  message: string;
}

export interface AutoPushSettings {
  inactive_30d?: AutoPushTriggerSettings;
  near_reward_80?: AutoPushTriggerSettings;
  birthday?: AutoPushTriggerSettings;
  google_review?: GoogleReviewSettings;
}

const TRIGGERS = ["inactive_30d", "near_reward_80", "birthday"] as const;

function sanitize(input: unknown): { settings: AutoPushSettings; error?: string } {
  const out: AutoPushSettings = {};
  if (!input || typeof input !== "object") return { settings: out };
  const o = input as Record<string, unknown>;
  for (const key of TRIGGERS) {
    const v = o[key];
    if (!v || typeof v !== "object") continue;
    const vv = v as Record<string, unknown>;
    out[key] = {
      enabled: vv.enabled !== false,
      message:
        typeof vv.message === "string" ? vv.message.trim().slice(0, 200) : "",
    };
  }
  const review = sanitizeGoogleReview(o.google_review);
  if (review.error) return { settings: out, error: review.error };
  if (review.value) out.google_review = review.value;
  return { settings: out };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
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
    return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });
  }
  // Page accessible avec `campaigns` (tous les plans payants). Les relances
  // événementielles restent réservées au plan Pro+ côté cron
  // (/api/cron/auto-push saute le plan Essentiel).
  const gate = requirePlan(business as BusinessBillingState, "campaigns");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, requiredPlan: gate.requiredPlan },
      { status: 402 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { settings, error: validationError } = sanitize(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cards")
    .update({ auto_push_settings: settings })
    .eq("id", id)
    .eq("business_id", profile.business_id)
    .select("id, auto_push_settings")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, settings: data.auto_push_settings });
}
