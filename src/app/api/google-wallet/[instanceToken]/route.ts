import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import {
  generateGoogleWalletPassUrl,
  isGoogleWalletConfigured,
} from "@/lib/google-wallet";
import { fetchPassLocations } from "@/lib/locations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ instanceToken: string }> }
) {
  try {
    if (!isGoogleWalletConfigured()) {
      return NextResponse.json(
        { error: "Google Wallet n'est pas encore configure" },
        { status: 503 }
      );
    }

    const { instanceToken } = await params;
    const supabase = createAdminClient();

    const { data: instance, error } = await supabase
      .from("card_instances")
      .select(`
        id, token, business_id, stamps_collected, rewards_available, status,
        cards(id, name, stamp_count, reward_text, design, barcode_type, wallet_business_name, businesses(name, logo_url)),
        clients(first_name, last_name)
      `)
      .eq("token", instanceToken)
      .single();

    if (error || !instance) {
      return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    }

    const card = instance.cards as unknown as {
      id: string;
      name: string;
      stamp_count: number;
      reward_text: string;
      design: Record<string, unknown>;
      barcode_type: "qr" | "pdf417" | null;
      wallet_business_name: string | null;
      businesses: { name: string; logo_url: string | null } | null;
    };
    const client = instance.clients as unknown as {
      first_name: string | null;
      last_name: string | null;
    } | null;
    const design = { ...DEFAULT_CARD_DESIGN, ...(card.design ?? {}) };

    const businessName = card.businesses?.name ?? "Commerce";
    // Google Wallet's accountName renders prominently — prefer just the
    // first name (matches Apple's secondaryFields personalization style),
    // fall back to "first last", then "Client".
    const firstName = (client?.first_name ?? "").trim();
    const lastName = (client?.last_name ?? "").trim();
    const customerName =
      firstName || `${firstName} ${lastName}`.trim() || "Client";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

    // Geo-push : embed les points de vente actifs dans la LoyaltyClass.
    const locations = await fetchPassLocations(supabase, instance.business_id);

    const url = generateGoogleWalletPassUrl({
      cardId: card.id,
      cardName: card.name,
      businessName,
      walletBusinessName: card.wallet_business_name,
      customerName,
      customerInstanceToken: instance.token,
      stampsCollected: instance.stamps_collected,
      stampsTotal: card.stamp_count,
      rewardsAvailable: instance.rewards_available,
      rewardText: card.reward_text,
      // Bg du pass = couleur de fond explicitement choisie par le merchant.
      // googleEffectiveBgColor() côté lib auto-flippe vers un fond sombre si
      // le merchant a choisi clair (Google force le texte blanc → illisible).
      bgColor:
        (design.background_color as string) ||
        (design.accent_color as string) ||
        "#ffffff",
      accentColor: (design.accent_color as string | null) ?? null,
      logoUrl: (design.logo_url as string | null) ?? card.businesses?.logo_url ?? null,
      bannerUrl: (design.banner_url as string | null) ?? null,
      appUrl,
      barcodeType: card.barcode_type ?? "qr",
      locations,
    });

    return NextResponse.redirect(url);
  } catch (err) {
    console.error("GET /api/google-wallet error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
