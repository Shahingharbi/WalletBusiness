import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const admin = createAdminClient();
    const body = await request.json();

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const first_name = typeof body.first_name === "string" ? body.first_name.trim() : "";
    const last_name = typeof body.last_name === "string" ? body.last_name.trim() : "";

    if (!email || !password || !first_name) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 422 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caracteres" },
        { status: 422 }
      );
    }

    const { data: invitation, error: invErr } = await admin
      .from("invitations")
      .select("id, business_id, email, status, expires_at")
      .eq("token", token)
      .single();

    if (invErr || !invitation) {
      return NextResponse.json({ error: "Invitation invalide" }, { status: 404 });
    }
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Cette invitation a deja ete utilisee ou revoquee" },
        { status: 400 }
      );
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation expiree" }, { status: 400 });
    }
    if (invitation.email !== email) {
      return NextResponse.json(
        { error: "L'email doit correspondre a celui de l'invitation" },
        { status: 400 }
      );
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role: "employee",
      },
    });

    if (createErr || !created.user) {
      return NextResponse.json(
        {
          error:
            createErr?.message?.includes("already")
              ? "Un compte existe deja avec cet email"
              : createErr?.message || "Erreur lors de la creation du compte",
        },
        { status: 400 }
      );
    }

    // The handle_new_user trigger creates a profile, but we need to
    // override business_id (employees inherit from invitation, not create new business).
    // We also flip role to employee and link to inviting business.
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        role: "employee",
        business_id: invitation.business_id,
        first_name,
        last_name,
      })
      .eq("id", created.user.id);

    if (profileErr) {
      console.error("Profile update error:", profileErr);
    }

    // The trigger may have created an empty business — clean it up.
    await admin
      .from("businesses")
      .delete()
      .eq("owner_id", created.user.id);

    await admin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/invitations/[token]/accept error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
