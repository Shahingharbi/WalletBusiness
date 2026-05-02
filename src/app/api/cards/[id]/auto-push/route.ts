import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requirePlan,
  type BusinessBillingState,
} from "@/lib/billing";

export const runtime = "nodejs";

export interface AutoPushTriggerSettings {
  enabled: boolean;
  message: string;
}

export interface AutoPushSettings {
  inactive_30d?: AutoPushTriggerSettings;
  near_reward_80?: AutoPushTriggerSettings;
  birthday?: AutoPushTriggerSettings;
}

const TRIGGERS = ["inactive_30d", "near_reward_80", "birthday"] as const;

function sanitize(input: unknown): AutoPushSettings {
  const out: AutoPushSettings = {};
  if (!input || typeof input !== "object") return out;
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
  return out;
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
  // Auto-push est aligné sur le gating `campaigns` (Pro+).
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

  const settings = sanitize(body);

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
