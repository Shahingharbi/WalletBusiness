import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import { requirePlan, type BusinessBillingState } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json(
        { error: "Commerce introuvable" },
        { status: 400 }
      );
    }

    // Charge l'état billing du business pour gating.
    const { data: business } = await supabase
      .from("businesses")
      .select("subscription_status, subscription_plan, trial_ends_at")
      .eq("id", profile.business_id)
      .single();

    const billingState: BusinessBillingState = {
      subscription_status: business?.subscription_status ?? null,
      subscription_plan: business?.subscription_plan ?? null,
      trial_ends_at: business?.trial_ends_at ?? null,
    };

    const { count: cardsCount } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", profile.business_id);

    const gate = requirePlan(billingState, "extra_cards", {
      currentCardsCount: cardsCount ?? 0,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.message,
          reason: gate.reason,
          requiredPlan: gate.requiredPlan,
        },
        { status: 402 }
      );
    }

    const body = await request.json();

    // Validation simple
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Le nom de la carte est requis" },
        { status: 422 }
      );
    }

    const design = { ...DEFAULT_CARD_DESIGN, ...body.design };

    // Optional override for the top-left of the wallet pass (Apple logoText /
    // Google issuerName). NULL = fall back to businesses.name.
    const walletBusinessName =
      typeof body.wallet_business_name === "string" &&
      body.wallet_business_name.trim().length > 0
        ? body.wallet_business_name.trim()
        : null;

    // Optional short offer phrase shown in the wallet pass auxiliary fields,
    // replacing the auto "X tampons" line. NULL = fall back to the count.
    const rewardSubtitle =
      typeof body.reward_subtitle === "string" &&
      body.reward_subtitle.trim().length > 0
        ? body.reward_subtitle.trim().slice(0, 60)
        : null;

    const { data: card, error: insertError } = await supabase
      .from("cards")
      .insert({
        business_id: profile.business_id,
        card_type: body.type || "stamp",
        name: body.name.trim(),
        stamp_count: body.max_stamps || 8,
        reward_text: body.reward_text || "Un repas offert !",
        barcode_type: body.barcode_type || "qr",
        expiration_type: body.expiration_type || "unlimited",
        expiration_date: body.expiration_date || null,
        expiration_days: body.expiration_days || null,
        wallet_business_name: walletBusinessName,
        reward_subtitle: rewardSubtitle,
        design,
        status: "draft",
      })
      .select("id, name, status, stamp_count, card_type")
      .single();

    if (insertError) {
      console.error("Card insert error:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de la création: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    console.error("POST /api/cards error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
