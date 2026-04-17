import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get profile - must be business_owner
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

    if (profile.role !== "business_owner") {
      return NextResponse.json(
        { error: "Seul le proprietaire peut activer une carte" },
        { status: 403 }
      );
    }

    // Get card and verify ownership
    const { data: card } = await supabase
      .from("cards")
      .select("id, status, business_id")
      .eq("id", id)
      .single();

    if (!card) {
      return NextResponse.json(
        { error: "Carte introuvable" },
        { status: 404 }
      );
    }

    if (card.business_id !== profile.business_id) {
      return NextResponse.json(
        { error: "Cette carte ne vous appartient pas" },
        { status: 403 }
      );
    }

    if (card.status !== "draft") {
      return NextResponse.json(
        { error: "Seule une carte en brouillon peut etre activee" },
        { status: 400 }
      );
    }

    // Activate
    const { error: updateError } = await supabase
      .from("cards")
      .update({ status: "active" })
      .eq("id", id);

    if (updateError) {
      console.error("Card activation error:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de l'activation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Carte activee avec succes",
    });
  } catch (err) {
    console.error("POST /api/cards/[id]/activate error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
