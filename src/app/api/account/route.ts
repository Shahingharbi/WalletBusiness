import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE /api/account
 *
 * RGPD — droit a l'effacement (art. 17 RGPD).
 * Supprime l'utilisateur Supabase Auth. La suppression du compte auth
 * declenche les ON DELETE CASCADE sur profiles -> businesses -> cards -> ...
 *
 * Si l'utilisateur est business_owner, son business et toutes les donnees
 * associees (cartes, clients, transactions) sont supprimes via CASCADE.
 *
 * Le client doit passer { confirm: "SUPPRIMER" } dans le body pour eviter
 * une suppression accidentelle.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    let body: { confirm?: string } = {};
    try {
      body = await request.json();
    } catch {
      // no body
    }

    if (body.confirm !== "SUPPRIMER") {
      return NextResponse.json(
        {
          error:
            "Confirmation requise. Envoyez { confirm: 'SUPPRIMER' } pour confirmer la suppression.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Delete the auth user. ON DELETE CASCADE on profiles (auth.users)
    // and on businesses.owner_id (auth.users) propagates to cards, clients,
    // card_instances, transactions, invitations, locations.
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      console.error("deleteUser error:", error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression du compte" },
        { status: 500 }
      );
    }

    // Sign out the current session cookies
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/account error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
