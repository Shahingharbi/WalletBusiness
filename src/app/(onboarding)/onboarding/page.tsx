import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

interface OnboardingPageProps {
  searchParams: Promise<{ step?: string; cardId?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { step: stepParam, cardId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, first_name")
    .eq("id", user.id)
    .single();

  if (!profile?.business_id) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, onboarding_completed_at, onboarding_data")
    .eq("id", profile.business_id)
    .single();

  if (business?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  // Resolve initial step. If a cardId is in the URL, jump to step 3 (poster).
  let initialStep = parseInt(stepParam ?? "1", 10);
  if (Number.isNaN(initialStep) || initialStep < 1 || initialStep > 3) initialStep = 1;
  if (cardId) initialStep = 3;

  // Look up an existing card for the business (if user came back to step 3).
  const { data: existingCard } = await supabase
    .from("cards")
    .select("id, name")
    .eq("business_id", profile.business_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <OnboardingWizard
      firstName={profile.first_name ?? ""}
      businessName={business?.name ?? ""}
      initialStep={initialStep}
      initialData={(business?.onboarding_data as Record<string, string> | null) ?? null}
      cardId={cardId ?? existingCard?.id ?? null}
      cardName={existingCard?.name ?? null}
    />
  );
}
