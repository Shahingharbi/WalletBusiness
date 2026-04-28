import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";
import {
  generateApplePassBuffer,
  isAppleWalletConfigured,
} from "@/lib/apple-wallet";

export const runtime = "nodejs"; // passkit-generator + fs => pas Edge

export async function GET(
  request: Request,
  { params }: { params: Promise<{ instanceToken: string }> }
) {
  try {
    if (!isAppleWalletConfigured()) {
      return NextResponse.json(
        { error: "Apple Wallet n'est pas encore configuré" },
        { status: 503 }
      );
    }

    const { instanceToken } = await params;
    const supabase = createAdminClient();

    const { data: instance, error } = await supabase
      .from("card_instances")
      .select(`
        id, token, stamps_collected, rewards_available, status,
        clients(first_name),
        cards(id, name, stamp_count, reward_text, design, businesses(name, logo_url))
      `)
      .eq("token", instanceToken)
      .single();

    if (error || !instance) {
      return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    }

    if (instance.status !== "active") {
      return NextResponse.json(
        { error: "Cette carte n'est plus active" },
        { status: 410 }
      );
    }

    const card = instance.cards as unknown as {
      id: string;
      name: string;
      stamp_count: number;
      reward_text: string;
      design: Record<string, unknown>;
      businesses: { name: string; logo_url: string | null } | null;
    };
    const client = instance.clients as unknown as {
      first_name: string | null;
    } | null;
    const design = { ...DEFAULT_CARD_DESIGN, ...(card.design ?? {}) };
    const businessName = card.businesses?.name ?? "Commerce";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

    const merchantLogoUrl =
      (design.logo_url as string | null) ??
      card.businesses?.logo_url ??
      null;

    const buffer = await generateApplePassBuffer({
      cardId: card.id,
      cardName: card.name,
      businessName,
      customerInstanceToken: instance.token,
      customerFirstName: client?.first_name ?? null,
      stampsCollected: instance.stamps_collected,
      stampsTotal: card.stamp_count,
      rewardsAvailable: instance.rewards_available,
      rewardText: card.reward_text,
      // Bg du pass = couleur de fond explicitement choisie par le merchant.
      // Si manquante, fallback sur l'accent (rare car DEFAULT_CARD_DESIGN.background_color = "#ffffff").
      backgroundColor:
        (design.background_color as string) ||
        (design.accent_color as string) ||
        "#ffffff",
      accentColor: (design.accent_color as string) || "#10b981",
      appUrl,
      logoUrl: merchantLogoUrl,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${card.name.replace(/[^a-z0-9-]/gi, "-")}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/apple-wallet error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }
}
