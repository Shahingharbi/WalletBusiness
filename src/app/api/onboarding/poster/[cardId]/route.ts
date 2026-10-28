import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPosterPdf } from "@/lib/poster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface CardDesign {
  accent_color?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await ctx.params;
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
      return NextResponse.json(
        { error: "Commerce introuvable" },
        { status: 400 }
      );
    }

    const { data: card } = await supabase
      .from("cards")
      .select(
        "id, name, reward_text, design, business_id, businesses(name, logo_url)"
      )
      .eq("id", cardId)
      .eq("business_id", profile.business_id)
      .maybeSingle();

    if (!card) {
      return NextResponse.json(
        { error: "Carte introuvable" },
        { status: 404 }
      );
    }

    const business = card.businesses as unknown as {
      name: string;
      logo_url: string | null;
    } | null;
    const design = (card.design || {}) as CardDesign;

    const origin = (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      _req.headers.get("origin") ??
      `https://${_req.headers.get("host") ?? "aswallet.app"}`
    ).replace(/\/$/, "");
    const installUrl = `${origin}/c/${card.id}`;

    const buffer = await renderPosterPdf({
      businessName: business?.name ?? "Votre commerce",
      cardName: card.name,
      rewardText: card.reward_text ?? "",
      qrValue: installUrl,
      accentColor: design.accent_color || "#fbbf24",
      backgroundColor: design.background_color || null,
      textColor: design.text_color || null,
      logoUrl: design.logo_url || business?.logo_url || null,
      photoUrl: design.banner_url || null,
      appUrl: origin,
    });

    const safeName = (card.name || "carte").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="affiche-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("poster error", err);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
