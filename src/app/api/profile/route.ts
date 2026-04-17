import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const update: Record<string, string | null> = {};

    if (typeof body.first_name === "string") update.first_name = body.first_name.trim();
    if (typeof body.last_name === "string") update.last_name = body.last_name.trim();
    if (typeof body.phone === "string") update.phone = body.phone.trim() || null;
    if (typeof body.avatar_url === "string" || body.avatar_url === null) {
      update.avatar_url = body.avatar_url || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Aucun champ a mettre a jour" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id);

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Erreur lors de la mise a jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
