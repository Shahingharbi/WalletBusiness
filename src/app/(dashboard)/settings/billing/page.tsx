import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import {
  PLANS,
  PLAN_ORDER,
  effectivePlan,
  isInTrial,
  isLockedOut,
  isSubscriptionActive,
  trialDaysRemaining,
  type BusinessBillingState,
  type PlanId,
} from "@/lib/billing";
import { BillingClient } from "./billing-client";
import type { InvoiceRow } from "./billing-client";

type SearchParamsResolved = {
  success?: string;
  canceled?: string;
};

interface PageProps {
  searchParams: Promise<SearchParamsResolved>;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", user.id)
    .single();

  if (!profile?.business_id) redirect("/dashboard");
  if (profile.role !== "business_owner") redirect("/dashboard");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan, subscription_interval, subscription_current_period_end, subscription_cancel_at_period_end, trial_ends_at"
    )
    .eq("id", profile.business_id)
    .single();

  if (!business) redirect("/dashboard");

  const billingState: BusinessBillingState = {
    subscription_status: business.subscription_status,
    subscription_plan: business.subscription_plan,
    trial_ends_at: business.trial_ends_at,
  };

  const inTrial = isInTrial(billingState);
  const trialDays = trialDaysRemaining(billingState);
  const lockedOut = isLockedOut(billingState);
  const active = isSubscriptionActive(business.subscription_status);
  const currentPlan: PlanId | null = active
    ? (effectivePlan(billingState) as PlanId)
    : null;

  // Récupère les invoices Stripe si un customer existe.
  let invoices: InvoiceRow[] = [];
  if (business.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const list = await stripe.invoices.list({
        customer: business.stripe_customer_id,
        limit: 12,
      });
      invoices = list.data.map((inv) => ({
        id: inv.id ?? "",
        number: inv.number ?? null,
        status: inv.status ?? null,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: inv.created,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        invoicePdf: inv.invoice_pdf ?? null,
      }));
    } catch (err) {
      console.error("[billing page] invoices.list failed:", err);
      // Si Stripe n'est pas configuré on affiche juste 0 facture.
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Retour aux paramètres"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Abonnement et facturation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez votre formule, votre mode de paiement et téléchargez vos
            factures.
          </p>
        </div>
      </div>

      <BillingClient
        successFlag={params.success === "1"}
        canceledFlag={params.canceled === "1"}
        currentPlan={currentPlan}
        subscriptionStatus={business.subscription_status}
        subscriptionInterval={
          business.subscription_interval === "year" ? "year" : "month"
        }
        cancelAtPeriodEnd={business.subscription_cancel_at_period_end ?? false}
        currentPeriodEnd={business.subscription_current_period_end}
        trialEndsAt={business.trial_ends_at}
        inTrial={inTrial}
        trialDaysRemaining={trialDays}
        lockedOut={lockedOut}
        hasStripeCustomer={Boolean(business.stripe_customer_id)}
        invoices={invoices}
        plans={PLAN_ORDER.map((id) => ({
          id,
          name: PLANS[id].name,
          monthlyPrice: PLANS[id].monthlyPrice,
          yearlyPrice: PLANS[id].yearlyPrice,
          description: PLANS[id].description,
          features: [...PLANS[id].features],
        }))}
      />
    </div>
  );
}
