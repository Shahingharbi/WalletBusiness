import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
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
        { error: "Seul le proprietaire peut inviter des employes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 422 });
    }

    const { data: existing } = await supabase
      .from("invitations")
      .select("id")
      .eq("business_id", profile.business_id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Une invitation est deja en attente pour cet email" },
        { status: 409 }
      );
    }

    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({
        business_id: profile.business_id,
        invited_by: user.id,
        email,
      })
      .select("id, email, token, expires_at")
      .single();

    if (error) {
      console.error("Invitation create error:", error);
      return NextResponse.json(
        { error: "Erreur lors de la creation de l'invitation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (err) {
    console.error("POST /api/invitations error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "business_owner") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("business_id", profile.business_id);

    if (error) {
      return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/invitations error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
