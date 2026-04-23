import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/account/export
 *
 * RGPD — droit a la portabilite (art. 20 RGPD).
 * Renvoie un fichier JSON contenant l'ensemble des donnees de l'utilisateur
 * authentifie et de son commerce.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Profile of the current user
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const businessId = profile?.business_id as string | null;

    // Business, cards, instances, clients, transactions, invitations, locations
    // Scoped to this user's business so we do not leak other tenants' data.
    const [
      business,
      cards,
      cardInstances,
      clients,
      transactions,
      invitations,
      locations,
      profiles,
    ] = businessId
      ? await Promise.all([
          admin.from("businesses").select("*").eq("id", businessId).maybeSingle(),
          admin.from("cards").select("*").eq("business_id", businessId),
          admin.from("card_instances").select("*").eq("business_id", businessId),
          admin.from("clients").select("*").eq("business_id", businessId),
          admin.from("transactions").select("*").eq("business_id", businessId),
          admin.from("invitations").select("*").eq("business_id", businessId),
          admin.from("locations").select("*").eq("business_id", businessId),
          admin.from("profiles").select("*").eq("business_id", businessId),
        ])
      : [
          { data: null },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [profile] },
        ];

    const payload = {
      meta: {
        service: "aswallet",
        exported_at: new Date().toISOString(),
        exported_for: {
          user_id: user.id,
          email: user.email,
        },
        notice:
          "Export RGPD (art. 15 et 20). Ce fichier contient vos données personnelles et celles de votre commerce au moment de l'export.",
      },
      auth_user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      profile,
      profiles: profiles.data ?? [],
      business: "data" in business ? business.data : null,
      cards: cards.data ?? [],
      card_instances: cardInstances.data ?? [],
      clients: clients.data ?? [],
      transactions: transactions.data ?? [],
      invitations: invitations.data ?? [],
      locations: locations.data ?? [],
    };

    const body = JSON.stringify(payload, null, 2);
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="aswallet-export-${today}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/account/export error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
