import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Reward-redemption endpoint: authenticated scanner. Cap at 20/min
  // to mitigate a compromised scanner draining rewards in bulk.
  const limited = await rateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    key: "redeem",
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifie" },
        { status: 401 }
      );
    }

    // Get scanner's profile and business
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json(
        { error: "Profil introuvable" },
        { status: 400 }
      );
    }

    if (profile.role !== "employee" && profile.role !== "business_owner") {
      return NextResponse.json(
        { error: "Acces non autorise" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { card_instance_id } = body;

    if (!card_instance_id || typeof card_instance_id !== "string") {
      return NextResponse.json(
        { error: "ID de carte requis" },
        { status: 422 }
      );
    }

    // Verify the instance belongs to the same business
    const { data: instance } = await supabase
      .from("card_instances")
      .select("id, business_id, rewards_available")
      .eq("id", card_instance_id)
      .single();

    if (!instance) {
      return NextResponse.json(
        { error: "Carte introuvable" },
        { status: 404 }
      );
    }

    if (instance.business_id !== profile.business_id) {
      return NextResponse.json(
        { error: "Cette carte n'appartient pas a votre commerce" },
        { status: 403 }
      );
    }

    if (instance.rewards_available <= 0) {
      return NextResponse.json(
        { error: "Aucune recompense disponible" },
        { status: 400 }
      );
    }

    // Call redeem_reward RPC
    const { data: redeemResult, error: redeemError } = await supabase.rpc(
      "redeem_reward",
      {
        p_card_instance_id: card_instance_id,
        p_scanned_by: user.id,
      }
    );

    if (redeemError) {
      console.error("redeem_reward error:", redeemError);
      return NextResponse.json(
        { error: redeemError.message || "Erreur lors de l'utilisation de la recompense" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recompense utilisee avec succes",
    });
  } catch (err) {
    console.error("POST /api/redeem error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
