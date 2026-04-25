import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  requirePlan,
  type BusinessBillingState,
} from "@/lib/billing";
import { CampaignsClient, type CampaignRow } from "./campaigns-client";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();
  if (!profile) notFound();

  const { data: card } = await supabase
    .from("cards")
    .select("id, name")
    .eq("id", id)
    .eq("business_id", profile.business_id)
    .single();
  if (!card) notFound();

  const { data: business } = await supabase
    .from("businesses")
    .select("subscription_status, subscription_plan, trial_ends_at")
    .eq("id", profile.business_id)
    .single();

  const gate = business
    ? requirePlan(business as BusinessBillingState, "campaigns")
    : { ok: false as const, message: "Plan requis", requiredPlan: "pro" as const };

  if (!gate.ok) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/cards/${card.id}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {card.name}
          </Link>
        </div>

        <Card className="border-beige-dark">
          <CardContent className="p-8 sm:p-12 text-center space-y-5">
            <div className="mx-auto h-16 w-16 rounded-full bg-yellow flex items-center justify-center">
              <Lock className="h-7 w-7 text-foreground" />
            </div>
            <h1
              className="text-2xl sm:text-3xl text-foreground"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              Réveillez vos clients endormis
            </h1>
            <p
              className="text-sm sm:text-base text-foreground/70 max-w-md mx-auto"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Envoyez un message en 1 clic à tous les porteurs de votre carte —
              ou seulement à ceux qui n&apos;ont pas scanné depuis 30 jours.
              Le message s&apos;affiche directement dans Apple Wallet et Google
              Wallet, avec une notification push.
            </p>
            <p className="text-sm text-foreground/60">
              {gate.message}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/settings/billing">
                <Button>Passer au plan Pro</Button>
              </Link>
              <Link href={`/cards/${card.id}`}>
                <Button variant="secondary">Retour à la carte</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Préfetch des campagnes existantes (RLS).
  const { data: campaignsRaw } = await supabase
    .from("campaigns")
    .select("id, message, segment, recipients_count, sent_at")
    .eq("card_id", card.id)
    .order("sent_at", { ascending: false })
    .limit(50);

  const campaigns: CampaignRow[] = (campaignsRaw ?? []).map((c) => ({
    id: c.id,
    message: c.message,
    segment: c.segment as CampaignRow["segment"],
    recipients_count: c.recipients_count,
    sent_at: c.sent_at,
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/cards/${card.id}`}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {card.name}
        </Link>
      </div>

      <div>
        <h1
          className="text-2xl sm:text-3xl text-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
        >
          Campagnes
        </h1>
        <p
          className="text-sm text-muted-foreground mt-1"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Envoyez un message wallet aux porteurs de cette carte. Notification
          push instantanée sur Google Wallet, message en back-of-card sur Apple
          Wallet.
        </p>
      </div>

      <CampaignsClient cardId={card.id} initialCampaigns={campaigns} />
    </div>
  );
}
