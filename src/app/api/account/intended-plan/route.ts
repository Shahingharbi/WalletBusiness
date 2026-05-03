import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPlanId,
  type PlanId,
  type BillingIntervalAlias,
} from "@/lib/billing";

export const runtime = "nodejs";

interface IntendedPlanBody {
  plan?: unknown;
  interval?: unknown;
}

/**
 * POST /api/account/intended-plan
 *
 * Stocke le plan + l'intervalle choisi par le merchant sur la page de
 * pricing AVANT qu'il ne lance son checkout Stripe (peut être plusieurs
 * jours plus tard, post-essai). Utilisé pour :
 *   - pré-remplir le bouton "Configurer le paiement" du banner d'essai
 *   - afficher "Vous avez choisi le plan X" sur le dashboard pré-conversion
 *
 * Best-effort : appelé depuis le client juste après `signUp`. Si la row
 * `businesses` n'existe pas encore (trigger SQL pas joué, RLS qui bloque,
 * etc.) on retourne 200 quand même afin de ne pas casser l'inscription.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    let body: IntendedPlanBody;
    try {
      body = (await request.json()) as IntendedPlanBody;
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }

    if (!isPlanId(body.plan)) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 422 });
    }
    const plan: PlanId = body.plan;

    const interval: BillingIntervalAlias =
      body.interval === "annual" ? "annual" : "monthly";

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.business_id || profile.role !== "business_owner") {
      // Best-effort : signup tout juste créé, le trigger n'a peut-être pas
      // encore matérialisé `profiles`. On répond 200 silencieux.
      return NextResponse.json({ ok: true, persisted: false });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("businesses")
      .update({
        intended_plan: plan,
        intended_interval: interval,
      })
      .eq("id", profile.business_id);

    if (error) {
      console.error("[intended-plan] update error:", error);
      return NextResponse.json({ ok: true, persisted: false });
    }

    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    console.error("POST /api/account/intended-plan error:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
