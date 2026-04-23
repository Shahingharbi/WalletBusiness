import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Public, unauthenticated endpoint that creates DB rows — keep this low.
  const limited = await rateLimit(request, {
    limit: 5,
    windowMs: 60_000,
    key: "install:token",
  });
  if (limited) return limited;

  try {
    const { token } = await params;
    const supabase = createAdminClient();
    const body = await request.json();
    const { first_name, phone, consent } = body;

    if (!first_name || typeof first_name !== "string" || !first_name.trim()) {
      return NextResponse.json(
        { error: "Le prénom est requis" },
        { status: 422 }
      );
    }

    // RGPD — consent check. The UI enforces a mandatory checkbox; we re-check
    // server-side to prevent bypass. We do not currently persist consent to
    // the database (scope: keep migrations stable). If a full audit trail is
    // needed later, add a `consent_given_at TIMESTAMPTZ` column on
    // card_instances and set it here via .insert({ ..., consent_given_at: new Date().toISOString() }).
    if (consent !== true) {
      return NextResponse.json(
        { error: "Consentement requis au traitement des données" },
        { status: 422 }
      );
    }

    // Get card by id (token = card.id for now)
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, business_id, status")
      .eq("id", token)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Carte introuvable" },
        { status: 404 }
      );
    }

    if (card.status !== "active") {
      return NextResponse.json(
        { error: "Cette carte n'est plus active" },
        { status: 400 }
      );
    }

    // Find or create client
    let clientId: string | null = null;

    if (phone) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("business_id", card.business_id)
        .eq("phone", phone.trim())
        .single();

      if (existingClient) {
        clientId = existingClient.id;
      }
    }

    if (!clientId) {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          business_id: card.business_id,
          first_name: first_name.trim(),
          phone: phone?.trim() || null,
        })
        .select("id")
        .single();

      if (clientError) {
        console.error("Client creation error:", clientError);
        return NextResponse.json(
          { error: "Erreur lors de la création du client" },
          { status: 500 }
        );
      }

      clientId = newClient.id;
    }

    // Check if client already has this card
    const { data: existingInstance } = await supabase
      .from("card_instances")
      .select("id, token")
      .eq("card_id", card.id)
      .eq("client_id", clientId)
      .single();

    if (existingInstance) {
      return NextResponse.json(
        { error: "Vous avez déjà cette carte", instance_token: existingInstance.token },
        { status: 409 }
      );
    }

    // Create card instance
    const { data: instance, error: instanceError } = await supabase
      .from("card_instances")
      .insert({
        card_id: card.id,
        client_id: clientId,
        business_id: card.business_id,
        status: "active",
        wallet_type: "pwa",
        stamps_collected: 0,
        rewards_available: 0,
      })
      .select("id, token")
      .single();

    if (instanceError) {
      console.error("Card instance creation error:", instanceError);
      return NextResponse.json(
        { error: "Erreur lors de l'installation de la carte" },
        { status: 500 }
      );
    }

    // Create transaction
    await supabase.from("transactions").insert({
      card_instance_id: instance.id,
      business_id: card.business_id,
      type: "card_installed",
    });

    return NextResponse.json(
      { instance_token: instance.token },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/install error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
