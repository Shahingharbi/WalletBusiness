import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import {
  getPriceId,
  isPlanId,
  isBillingInterval,
  type PlanId,
  type BillingInterval,
} from "@/lib/billing";

export const runtime = "nodejs";

interface CheckoutBody {
  plan?: unknown;
  interval?: unknown;
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

    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    const plan: PlanId = isPlanId(body.plan) ? body.plan : "pro";
    const interval: BillingInterval = isBillingInterval(body.interval)
      ? body.interval
      : "month";

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
    const message =
      err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
