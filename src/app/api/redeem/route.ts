import { NextResponse, after } from "next/server";
import { canScan } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { syncLoyaltyObject } from "@/lib/google-wallet";
import { pushAppleWalletUpdate } from "@/lib/apple-wallet-push";

export async function POST(request: Request) {
  // Reward-redemption endpoint: authenticated scanner. Cap at 20/min
  // to mitigate a compromised scanner draining rewards in bulk.
  const limited = await rateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    key: "redeem",
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Get scanner's profile and business
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json(
        { error: "Profil introuvable" },
        { status: 400 }
      );
    }

    if (!canScan(profile.role)) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { card_instance_id } = body;

    if (!card_instance_id || typeof card_instance_id !== "string") {
      return NextResponse.json(
        { error: "ID de carte requis" },
        { status: 422 }
      );
    }

    // Verify the instance belongs to the same business
    const { data: instance } = await supabase
      .from("card_instances")
      .select(
        `id, token, business_id, rewards_available, stamps_collected,
         cards(card_type, stamp_count, design)`,
      )
      .eq("id", card_instance_id)
      .single();

    if (!instance) {
      return NextResponse.json(
        { error: "Carte introuvable" },
        { status: 404 }
      );
    }

    if (instance.business_id !== profile.business_id) {
      return NextResponse.json(
        { error: "Cette carte n'appartient pas à votre commerce" },
        { status: 403 }
      );
    }

    if (instance.rewards_available <= 0) {
      return NextResponse.json(
        { error: "Aucune récompense disponible" },
        { status: 400 }
      );
    }

    // Call redeem_reward RPC
    const { data: redeemResult, error: redeemError } = await supabase.rpc(
      "redeem_reward",
      {
        p_card_instance_id: card_instance_id,
        p_scanned_by: user.id,
      }
    );

    if (redeemError) {
      console.error("redeem_reward error:", redeemError);
      return NextResponse.json(
        { error: redeemError.message || "Erreur lors de l'utilisation de la récompense" },
        { status: 500 }
      );
    }

    // Live update wallet : la récompense vient de passer de N → N-1, le tel
    // du client doit le voir tout de suite. Sans ce push, le client gardait
    // visuellement "1 récompense disponible" jusqu'à la prochaine ouverture
    // manuelle de la carte → mauvaise expérience.
    const card = instance.cards as unknown as {
      card_type: string | null;
      stamp_count: number;
      design: Record<string, unknown> | null;
    } | null;
    const labelStamps =
      typeof card?.design?.label_stamps === "string"
        ? (card.design.label_stamps as string)
        : null;
    const ck = card?.card_type;
    const cardKind: "stamp" | "cashback" | "discount" | "membership" =
      ck === "cashback" || ck === "discount" || ck === "membership"
        ? ck
        : "stamp";
    const newRewards = Math.max(0, (instance.rewards_available ?? 1) - 1);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

    after(async () => {
      try {
        await syncLoyaltyObject(
          instance.token,
          instance.stamps_collected,
          newRewards,
          appUrl,
          undefined,
          card?.stamp_count,
          labelStamps,
          cardKind,
        );
      } catch (err) {
        console.error("[redeem/after] syncLoyaltyObject failed:", err);
      }
      try {
        await pushAppleWalletUpdate(instance.token);
      } catch (err) {
        console.error("[redeem/after] pushAppleWalletUpdate failed:", err);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Récompense utilisée avec succès",
    });
  } catch (err) {
    console.error("POST /api/redeem error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
