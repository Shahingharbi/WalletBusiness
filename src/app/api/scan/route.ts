import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLoyaltyObject } from "@/lib/google-wallet";
import { pushAppleWalletUpdate } from "@/lib/apple-wallet-push";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
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

    if (profile.role !== "employee" && profile.role !== "business_owner") {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { token, stamps } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token requis" },
        { status: 422 }
      );
    }

    const stampValue = Number.isInteger(stamps) ? stamps : 1;
    if (stampValue < 1 || stampValue > 20) {
      return NextResponse.json(
        { error: "Nombre de tampons invalide (1 à 20)" },
        { status: 422 }
      );
    }

    // Find card instance by token
    const { data: instance, error: instanceError } = await supabase
      .from("card_instances")
      .select(`
        id, token, stamps_collected, rewards_available, status, card_id,
        business_id,
        cards(id, name, stamp_count, reward_text),
        clients(id, first_name)
      `)
      .eq("token", token.trim())
      .single();

    if (instanceError || !instance) {
      return NextResponse.json(
        { error: "Carte client introuvable. Vérifiez le code." },
        { status: 404 }
      );
    }

    // Verify same business
    if (instance.business_id !== profile.business_id) {
      return NextResponse.json(
        { error: "Cette carte n'appartient pas à votre commerce" },
        { status: 403 }
      );
    }

    if (instance.status !== "active") {
      return NextResponse.json(
        { error: "Cette carte n'est plus active" },
        { status: 400 }
      );
    }

    // Double-scan protection (60s window) — based on last stamp_add transaction
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentScan } = await supabase
      .from("transactions")
      .select("id, created_at")
      .eq("card_instance_id", instance.id)
      .eq("type", "stamp_add")
      .gte("created_at", oneMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentScan) {
      return NextResponse.json(
        {
          error:
            "Un tampon vient déjà d'être ajouté pour ce client. Patientez 1 minute.",
        },
        { status: 429 }
      );
    }

    const card = instance.cards as unknown as {
      id: string;
      name: string;
      stamp_count: number;
      reward_text: string;
    };
    const client = instance.clients as unknown as {
      id: string;
      first_name: string;
    };

    // Call add_stamp RPC
    const { data: stampResult, error: stampError } = await supabase.rpc(
      "add_stamp",
      {
        p_card_instance_id: instance.id,
        p_scanned_by: user.id,
        p_value: stampValue,
      }
    );

    if (stampError) {
      console.error("add_stamp error:", stampError);
      return NextResponse.json(
        { error: stampError.message || "Erreur lors de l'ajout du tampon" },
        { status: 500 }
      );
    }

    // The RPC should return updated stamp count, but let's refetch to be safe
    const { data: updated } = await supabase
      .from("card_instances")
      .select("stamps_collected, rewards_available")
      .eq("id", instance.id)
      .single();

    const newStamps = updated?.stamps_collected ?? instance.stamps_collected + 1;
    const newRewards = updated?.rewards_available ?? instance.rewards_available;
    const rewardEarned = newRewards > instance.rewards_available;

    // Sync count to Google Wallet if the user previously added the pass.
    // Swallow errors so scan never fails because of a Wallet hiccup.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";
    await syncLoyaltyObject(
      instance.token,
      newStamps,
      newRewards,
      appUrl,
      undefined,
      card.stamp_count
    );

    // Push Apple Wallet (live update via APNs). Fire-and-forget : tout
    // problème APNs ne doit jamais faire échouer le scan.
    void pushAppleWalletUpdate(instance.token).catch((err) => {
      console.error("[scan] pushAppleWalletUpdate failed:", err);
    });

    // Notify customer if a new reward was just earned. Fire-and-forget.
    if (rewardEarned) {
      void notifyCustomerRewardEarned({
        clientId: client.id,
        businessId: instance.business_id,
        cardId: card.id,
        instanceToken: instance.token,
        rewardText: card.reward_text,
        appUrl,
      });
    }

    return NextResponse.json({
      success: true,
      client_name: client.first_name,
      stamps_collected: newStamps,
      max_stamps: card.stamp_count,
      rewards_available: newRewards,
      reward_text: card.reward_text,
      card_instance_id: instance.id,
      reward_earned: rewardEarned,
    });
  } catch (err) {
    console.error("POST /api/scan error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Notify a customer that they just unlocked a reward. Best-effort: any
 * failure (no email on file, Resend unconfigured, etc.) is logged and
 * swallowed so the scan flow stays robust.
 */
async function notifyCustomerRewardEarned(args: {
  clientId: string;
  businessId: string;
  cardId: string;
  instanceToken: string;
  rewardText: string;
  appUrl: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: client } = await admin
      .from("clients")
      .select("first_name, email")
      .eq("id", args.clientId)
      .single();
    if (!client?.email) return;

    const { data: business } = await admin
      .from("businesses")
      .select("name")
      .eq("id", args.businessId)
      .single();

    await sendEmail({
      to: client.email,
      template: "reward-earned",
      data: {
        firstName: client.first_name ?? undefined,
        rewardText: args.rewardText,
        businessName: business?.name ?? "votre commerce",
        // Status page: /c/[cardId]/status/[instanceToken].
        walletUrl: `${args.appUrl}/c/${args.cardId}/status/${args.instanceToken}`,
      },
    });
  } catch (err) {
    console.error("[scan] notifyCustomerRewardEarned failed:", err);
  }
}
