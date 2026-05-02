import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  requirePlan,
  type BusinessBillingState,
} from "@/lib/billing";
import { AutoPushClient } from "./auto-push-client";
import type { AutoPushSettings } from "@/app/api/cards/[id]/auto-push/route";

export default async function AutoPushPage({
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
    .select("id, name, reward_text, stamp_count, auto_push_settings")
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
              Pilote automatique
            </h1>
            <p
              className="text-sm sm:text-base text-foreground/70 max-w-md mx-auto"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Envoyez automatiquement une notification wallet quand un client
              est inactif depuis 30 jours, est à 80 % de sa récompense, ou fête
              son anniversaire.
            </p>
            <p className="text-sm text-foreground/60">{gate.message}</p>
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

  const settings = (card.auto_push_settings ?? {}) as AutoPushSettings;

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

      <div>
        <h1
          className="text-2xl sm:text-3xl text-foreground flex items-center gap-2"
          style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
        >
          <Zap className="h-7 w-7 text-yellow-500" />
          Pilote automatique
        </h1>
        <p
          className="text-sm text-muted-foreground mt-1"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Notifications wallet envoyées automatiquement chaque jour à 10 h. Les
          variables {"{name}"}, {"{reward}"} et {"{remaining}"} sont remplacées
          dans vos messages.
        </p>
      </div>

      <AutoPushClient
        cardId={card.id}
        rewardText={card.reward_text}
        stampCount={card.stamp_count}
        initialSettings={settings}
      />
    </div>
  );
}
