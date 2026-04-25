import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BillingBanner } from "@/components/dashboard/billing-banner";
import {
  isInTrial,
  isLockedOut,
  trialDaysRemaining,
  type BusinessBillingState,
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
      "id, name, slug, logo_url, category, subscription_status, subscription_plan, trial_ends_at"
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

  // Affiche un bandeau si essai expiré OU s'il reste 3 jours ou moins.
  const showBanner =
    locked ||
    (trial && trialDays !== null && trialDays <= 3) ||
    business?.subscription_status === "past_due";

  return (
    <DashboardShell user={userData}>
      {showBanner && (
        <BillingBanner
          variant={
            locked || business?.subscription_status === "past_due"
              ? "danger"
              : "warning"
          }
          locked={locked}
          pastDue={business?.subscription_status === "past_due"}
          trialDaysRemaining={trial ? trialDays : null}
        />
      )}
      {children}
    </DashboardShell>
  );
}
