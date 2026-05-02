import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
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
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, slug, logo_url, category")
      .eq("id", profile.business_id)
      .single();

    return NextResponse.json({ business });
  } catch (err) {
    console.error("GET /api/business error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 400 });
    }
    if (profile.role !== "business_owner") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut modifier le commerce" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const update: Record<string, string | null> = {};

    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.address === "string" || body.address === null) update.address = body.address || null;
    if (typeof body.city === "string" || body.city === null) update.city = body.city || null;
    if (typeof body.postal_code === "string" || body.postal_code === null) update.postal_code = body.postal_code || null;
    if (typeof body.phone === "string" || body.phone === null) update.phone = body.phone || null;
    if (typeof body.category === "string" || body.category === null) update.category = body.category || null;
    if (typeof body.logo_url === "string" || body.logo_url === null) update.logo_url = body.logo_url || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const { error } = await supabase
      .from("businesses")
      .update(update)
      .eq("id", profile.business_id);

    if (error) {
      console.error("Business update error:", error);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/business error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
