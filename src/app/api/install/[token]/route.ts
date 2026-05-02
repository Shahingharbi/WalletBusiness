import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { syncLoyaltyObject } from "@/lib/google-wallet";

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
      .select("id, business_id, status, name, reward_text, design")
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

    // Welcome offer auto : si la carte a un `welcome_reward` configuré, on
    // crédite immédiatement 1 récompense et on envoie une notification.
    const design = (card.design ?? {}) as Record<string, unknown>;
    const welcomeReward =
      typeof design.welcome_reward === "string"
        ? design.welcome_reward.trim()
        : "";
    const initialRewards = welcomeReward ? 1 : 0;

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
        rewards_available: initialRewards,
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

    if (welcomeReward) {
      await supabase.from("transactions").insert({
        card_instance_id: instance.id,
        business_id: card.business_id,
        type: "reward_earned",
        notes: `Offre de bienvenue : ${welcomeReward}`,
      });
    }

    // Notify the merchant — fire-and-forget so it never blocks the response.
    void notifyMerchantCardInstalled(supabase, card.business_id, card.id);

    if (welcomeReward && clientId) {
      // Best-effort : push wallet + email client si on a un email.
      void deliverWelcomeOffer({
        supabase,
        instanceToken: instance.token,
        clientId,
        cardId: card.id,
        cardName: card.name,
        businessId: card.business_id,
        welcomeReward,
        initialRewards,
      });
    }

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

/**
 * Délivre l'offre de bienvenue : Google Wallet push (silencieux si pas
 * encore ajouté au wallet, c'est attendu) + email Resend si on a un email
 * sur la fiche client. Best effort : aucune erreur ne casse l'install.
 */
async function deliverWelcomeOffer(args: {
  supabase: ReturnType<typeof createAdminClient>;
  instanceToken: string;
  clientId: string;
  cardId: string;
  cardName: string;
  businessId: string;
  welcomeReward: string;
  initialRewards: number;
}): Promise<void> {
  const {
    supabase,
    instanceToken,
    clientId,
    cardId,
    cardName,
    businessId,
    welcomeReward,
    initialRewards,
  } = args;
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

    // Push Google Wallet (no-op si l'utilisateur n'a pas encore ajouté la
    // carte à Google Wallet — totalement normal au moment de l'install).
    void syncLoyaltyObject(
      instanceToken,
      0,
      initialRewards,
      appUrl,
      `Bienvenue ! Voici votre offre : ${welcomeReward}`
    ).catch(() => undefined);

    // Email client si on connait son email (form actuel ne le capture pas
    // mais un commerçant peut renseigner un email sur la fiche client).
    const { data: client } = await supabase
      .from("clients")
      .select("email, first_name")
      .eq("id", clientId)
      .single();

    if (!client?.email) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .single();

    await sendEmail({
      to: client.email,
      template: "reward-earned",
      subject: `Bienvenue ${client.first_name ?? ""} — votre offre est dans votre wallet`,
      data: {
        firstName: client.first_name ?? undefined,
        rewardText: welcomeReward,
        businessName: business?.name ?? cardName,
        // Status page lives at /c/[cardId]/status/[instanceToken].
        walletUrl: `${appUrl}/c/${cardId}/status/${instanceToken}`,
      },
    });
  } catch (err) {
    console.error("[install] deliverWelcomeOffer failed:", err);
  }
}

/**
 * Send the "card installed" email to the merchant. Best-effort: any failure
 * is logged and swallowed so the install flow stays robust.
 */
async function notifyMerchantCardInstalled(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  cardId: string
): Promise<void> {
  try {
    const { data: card } = await supabase
      .from("cards")
      .select("name")
      .eq("id", cardId)
      .single();

    const { data: business } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", businessId)
      .single();

    if (!card || !business?.owner_id) return;

    // Fetch the owner's email via auth.admin (service role).
    const { data: ownerAuth } = await supabase.auth.admin.getUserById(
      business.owner_id
    );
    const ownerEmail = ownerAuth?.user?.email;
    if (!ownerEmail) return;

    // Total clients on this card.
    const { count } = await supabase
      .from("card_instances")
      .select("id", { count: "exact", head: true })
      .eq("card_id", cardId);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
    await sendEmail({
      to: ownerEmail,
      template: "card-installed",
      data: {
        cardName: card.name,
        totalClients: count ?? 1,
        dashboardUrl: `${appUrl}/dashboard/clients`,
      },
    });
  } catch (err) {
    console.error("[install] notifyMerchantCardInstalled failed:", err);
  }
}
