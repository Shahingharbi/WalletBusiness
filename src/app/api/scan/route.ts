import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token requis" },
        { status: 422 }
      );
    }

    // Find card instance by token
    const { data: instance, error: instanceError } = await supabase
      .from("card_instances")
      .select(`
        id, token, stamps_collected, rewards_available, status, card_id,
        business_id,
        cards(id, name, stamp_count, reward_text),
        clients(id, first_name)
      `)
      .eq("token", token.trim())
      .single();

    if (instanceError || !instance) {
      return NextResponse.json(
        { error: "Carte client introuvable. Verifiez le code." },
        { status: 404 }
      );
    }

    // Verify same business
    if (instance.business_id !== profile.business_id) {
      return NextResponse.json(
        { error: "Cette carte n'appartient pas a votre commerce" },
        { status: 403 }
      );
    }

    if (instance.status !== "active") {
      return NextResponse.json(
        { error: "Cette carte n'est plus active" },
        { status: 400 }
      );
    }

    // Double-scan protection (60s window) — based on last stamp_add transaction
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentScan } = await supabase
      .from("transactions")
      .select("id, created_at")
      .eq("card_instance_id", instance.id)
      .eq("type", "stamp_add")
      .gte("created_at", oneMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentScan) {
      return NextResponse.json(
        {
          error:
            "Un tampon vient deja d'etre ajoute pour ce client. Patientez 1 minute.",
        },
        { status: 429 }
      );
    }

    const card = instance.cards as unknown as {
      id: string;
      name: string;
      stamp_count: number;
      reward_text: string;
    };
    const client = instance.clients as unknown as {
      id: string;
      first_name: string;
    };

    // Call add_stamp RPC
    const { data: stampResult, error: stampError } = await supabase.rpc(
      "add_stamp",
      {
        p_card_instance_id: instance.id,
        p_scanned_by: user.id,
      }
    );

    if (stampError) {
      console.error("add_stamp error:", stampError);
      return NextResponse.json(
        { error: stampError.message || "Erreur lors de l'ajout du tampon" },
        { status: 500 }
      );
    }

    // The RPC should return updated stamp count, but let's refetch to be safe
    const { data: updated } = await supabase
      .from("card_instances")
      .select("stamps_collected, rewards_available")
      .eq("id", instance.id)
      .single();

    const newStamps = updated?.stamps_collected ?? instance.stamps_collected + 1;
    const newRewards = updated?.rewards_available ?? instance.rewards_available;
    const rewardEarned = newRewards > instance.rewards_available;

    return NextResponse.json({
      success: true,
      client_name: client.first_name,
      stamps_collected: newStamps,
      max_stamps: card.stamp_count,
      rewards_available: newRewards,
      reward_text: card.reward_text,
      card_instance_id: instance.id,
      reward_earned: rewardEarned,
    });
  } catch (err) {
    console.error("POST /api/scan error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
