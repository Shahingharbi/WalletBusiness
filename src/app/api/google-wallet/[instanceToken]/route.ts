import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import {
  generateGoogleWalletPassUrl,
  isGoogleWalletConfigured,
} from "@/lib/google-wallet";

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
        id, token, stamps_collected, rewards_available, status,
        cards(id, name, stamp_count, reward_text, design, barcode_type, businesses(name, logo_url)),
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

    const url = generateGoogleWalletPassUrl({
      cardId: card.id,
      cardName: card.name,
      businessName,
      customerName,
      customerInstanceToken: instance.token,
      stampsCollected: instance.stamps_collected,
      stampsTotal: card.stamp_count,
      rewardsAvailable: instance.rewards_available,
      rewardText: card.reward_text,
      bgColor: (design.accent_color as string) || "#10b981",
      logoUrl: (design.logo_url as string | null) ?? card.businesses?.logo_url ?? null,
      bannerUrl: (design.banner_url as string | null) ?? null,
      appUrl,
      barcodeType: card.barcode_type ?? "qr",
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
