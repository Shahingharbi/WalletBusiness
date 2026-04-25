import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
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
      return NextResponse.json({ error: "Profil introuvable" }, { status: 400 });
    }

    const url = new URL(request.url);
    const cardId = url.searchParams.get("cardId");
    if (!cardId) {
      return NextResponse.json({ error: "cardId requis" }, { status: 422 });
    }

    const { data: card } = await supabase
      .from("cards")
      .select("id")
      .eq("id", cardId)
      .eq("business_id", profile.business_id)
      .single();

    if (!card) {
      return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    }

    const { data: instances } = await supabase
      .from("card_instances")
      .select(
        "rewards_available, rewards_redeemed, last_scanned_at, status, created_at"
      )
      .eq("card_id", cardId);

    const list = (instances ?? []).filter((i) => i.status === "active");
    const now = Date.now();
    const counts = {
      all: list.length,
      inactive_30d: list.filter((i) => {
        const lastSeen = i.last_scanned_at
          ? new Date(i.last_scanned_at).getTime()
          : new Date(i.created_at).getTime();
        return now - lastSeen >= THIRTY_DAYS_MS;
      }).length,
      has_reward: list.filter((i) => (i.rewards_available ?? 0) > 0).length,
      never_redeemed: list.filter((i) => (i.rewards_redeemed ?? 0) === 0).length,
    };

    return NextResponse.json({ counts });
  } catch (err) {
    console.error("GET /api/campaigns/segment-counts error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
