import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupPriceId, type PlanId } from "@/lib/billing";

export const runtime = "nodejs";
// Stripe webhooks must read the raw body for signature verification.
export const dynamic = "force-dynamic";

interface BusinessUpdate {
  subscription_status?: string | null;
  subscription_plan?: PlanId | null;
  subscription_interval?: "month" | "year" | null;
  stripe_subscription_id?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean;
}

function tsToIso(ts: number | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function applySubscription(
  sub: Stripe.Subscription
): Promise<void> {
  const admin = createAdminClient();

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Identifie le business : metadata d'abord, sinon par customer_id.
  let businessId: string | null = null;
  const metaBusinessId = sub.metadata?.business_id;
  if (metaBusinessId) {
    businessId = metaBusinessId;
  } else {
    const { data } = await admin
      .from("businesses")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    businessId = data?.id ?? null;
  }

  if (!businessId) {
    console.warn(
      `[stripe webhook] Subscription ${sub.id} : business introuvable (customer ${customerId})`
    );
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price.id ?? null;
  const lookup = priceId ? lookupPriceId(priceId) : null;
  const plan: PlanId | null =
    lookup?.plan ??
    (sub.metadata?.plan === "starter" ||
    sub.metadata?.plan === "pro" ||
    sub.metadata?.plan === "business"
      ? (sub.metadata.plan as PlanId)
      : null);
  const interval: "month" | "year" | null =
    lookup?.interval ?? (item?.price.recurring?.interval === "year" ? "year" : "month");

  // current_period_end peut vivre sur l'item ou sur la sub selon la version
  // Stripe. On lit les deux.
  const subWithPeriod = sub as Stripe.Subscription & {
    current_period_end?: number;
  };
  const periodEnd =
    subWithPeriod.current_period_end ??
    item?.current_period_end ??
    null;

  const update: BusinessUpdate = {
    subscription_status: sub.status,
    subscription_plan: plan,
    subscription_interval: interval,
    stripe_subscription_id: sub.id,
    subscription_current_period_end: tsToIso(periodEnd),
    subscription_cancel_at_period_end: sub.cancel_at_period_end,
  };

  const { error } = await admin
    .from("businesses")
    .update(update)
    .eq("id", businessId);

  if (error) {
    console.error("[stripe webhook] update business error:", error);
  }
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const admin = createAdminClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await admin
    .from("businesses")
    .update({
      subscription_status: "canceled",
      stripe_subscription_id: null,
      subscription_cancel_at_period_end: false,
    })
    .eq("stripe_customer_id", customerId);
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const admin = createAdminClient();
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  if (!customerId) return;

  await admin
    .from("businesses")
    .update({ subscription_status: "past_due" })
    .eq("stripe_customer_id", customerId);
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  // En subscription mode, le webhook customer.subscription.created arrive aussi
  // donc on synchronise par sécurité (idempotent côté DB).
  if (session.mode !== "subscription") return;
  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subId) return;
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subId);
  await applySubscription(sub);
}

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Signature Stripe absente" },
      { status: 400 }
    );
  }

  let secret: string;
  try {
    secret = getStripeWebhookSecret();
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Webhook non configuré" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signature invalide";
    console.error("[stripe webhook] signature invalide:", msg);
    return NextResponse.json(
      { error: `Signature invalide: ${msg}` },
      { status: 400 }
    );
  }

  // Idempotence : on enregistre l'event id, et si déjà reçu on no-op.
  const admin = createAdminClient();
  const { error: insertErr } = await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (insertErr) {
    // Code 23505 = unique_violation -> déjà traité, on retourne 200.
    if (insertErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe webhook] insert event error:", insertErr);
    // On continue quand même : un echec d'insert ne doit pas perdre l'event.
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Ignore les autres event types — on les conserve dans stripe_events
        // pour audit.
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    return NextResponse.json(
      { error: "Erreur traitement événement" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
