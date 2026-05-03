import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  getPriceId,
  isStripePlanId,
  isBillingIntervalLike,
  normalizeBillingInterval,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing";

export const runtime = "nodejs";

interface CheckoutBody {
  plan?: unknown;
  interval?: unknown;
}

/**
 * Crée une session Stripe Checkout pour le business courant.
 *
 * Accepte :
 *  - body JSON `{ plan, interval }` (POST)
 *  - query string `?plan=&interval=`  (POST avec body vide / GET pour debug)
 *
 * Plans valides : starter | pro | business (Enterprise = sales assisté).
 * Intervalles : month | year (et alias UI monthly | annual).
 */
async function readArgs(request: Request): Promise<{
  plan: Exclude<PlanId, "enterprise">;
  interval: BillingInterval;
} | { error: string; status: number }> {
  const url = new URL(request.url);
  let body: CheckoutBody = {};
  try {
    body = (await request.json().catch(() => ({}))) as CheckoutBody;
  } catch {
    body = {};
  }

  const planRaw = body.plan ?? url.searchParams.get("plan");
  const intervalRaw = body.interval ?? url.searchParams.get("interval");

  if (!isStripePlanId(planRaw)) {
    return {
      error:
        "Plan invalide. Plans souscriptibles : starter, pro, business. Pour Enterprise, contactez les ventes.",
      status: 422,
    };
  }
  if (!isBillingIntervalLike(intervalRaw)) {
    return { error: "Intervalle de facturation invalide.", status: 422 };
  }

  return {
    plan: planRaw,
    interval: normalizeBillingInterval(intervalRaw),
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, stripe_customer_id, subscription_status")
      .eq("id", profile.business_id)
      .single();

    if (!business) {
      return NextResponse.json(
        { error: "Commerce introuvable" },
        { status: 400 }
      );
    }

    const args = await readArgs(request);
    if ("error" in args) {
      return NextResponse.json(
        { error: args.error },
        { status: args.status }
      );
    }
    const { plan, interval } = args;

    const stripe = getStripe();
    const priceId = getPriceId(plan, interval);

    // Réutilise ou crée le customer Stripe.
    let customerId = business.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: business.name,
        metadata: {
          business_id: business.id,
          user_id: user.id,
        },
      });
      customerId = customer.id;
      const admin = createAdminClient();
      await admin
        .from("businesses")
        .update({ stripe_customer_id: customerId })
        .eq("id", business.id);
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      success_url: `${appUrl}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings/billing?canceled=1`,
      subscription_data: {
        metadata: {
          business_id: business.id,
          plan,
          interval,
        },
      },
      metadata: {
        business_id: business.id,
        plan,
        interval,
      },
      locale: "fr",
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "URL Stripe indisponible" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error("POST /api/billing/checkout error:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
