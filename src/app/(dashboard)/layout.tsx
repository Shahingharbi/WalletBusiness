import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BillingBanner } from "@/components/dashboard/billing-banner";
import {
  isInTrial,
  isLockedOut,
  isPlanId,
  trialDaysRemaining,
  type BillingIntervalAlias,
  type BusinessBillingState,
  type PlanId,
} from "@/lib/billing";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, business_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "employee") {
    redirect("/scanner");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, logo_url, category, subscription_status, subscription_plan, trial_ends_at, intended_plan, intended_interval"
    )
    .eq("id", profile.business_id)
    .single();

  const userData = {
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    email: user.email ?? "",
    businessName: business?.name ?? "",
  };

  const billingState: BusinessBillingState = {
    subscription_status: business?.subscription_status ?? null,
    subscription_plan: business?.subscription_plan ?? null,
    trial_ends_at: business?.trial_ends_at ?? null,
  };

  const trialDays = trialDaysRemaining(billingState);
  const trial = isInTrial(billingState);
  const locked = isLockedOut(billingState);

  // Affiche un bandeau :
  //  - essai expiré (locked)                                      → danger
  //  - paiement en retard                                          → danger
  //  - essai actif avec ≤ 5 jours restants (= J+25 sur 30)         → warning (orange)
  //  - essai actif avec > 5 jours restants                         → soft (jaune doux)
  const showBanner =
    locked ||
    business?.subscription_status === "past_due" ||
    trial;

  let variant: "danger" | "warning" | "soft" = "soft";
  if (locked || business?.subscription_status === "past_due") {
    variant = "danger";
  } else if (trial && trialDays !== null && trialDays <= 5) {
    variant = "warning";
  }

  const intendedPlan: PlanId | null = isPlanId(business?.intended_plan)
    ? business.intended_plan
    : null;
  const intendedInterval: BillingIntervalAlias | null =
    business?.intended_interval === "annual" ||
    business?.intended_interval === "monthly"
      ? business.intended_interval
      : null;

  return (
    <DashboardShell user={userData}>
      {showBanner && (
        <BillingBanner
          variant={variant}
          locked={locked}
          pastDue={business?.subscription_status === "past_due"}
          trialDaysRemaining={trial ? trialDays : null}
          intendedPlan={intendedPlan}
          intendedInterval={intendedInterval}
        />
      )}
      {children}
    </DashboardShell>
  );
}
