"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import {
  isStripePlanId,
  type PlanId,
  type BillingIntervalAlias,
} from "@/lib/billing";

interface BillingBannerProps {
  variant: "warning" | "danger" | "soft";
  locked: boolean;
  pastDue: boolean;
  trialDaysRemaining: number | null;
  /** Plan choisi à l'inscription (peut être null si signup historique). */
  intendedPlan?: PlanId | null;
  intendedInterval?: BillingIntervalAlias | null;
}

export function BillingBanner({
  variant,
  locked,
  pastDue,
  trialDaysRemaining,
  intendedPlan = null,
  intendedInterval = null,
}: BillingBannerProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let message: string;
  let cta: string;

  if (locked) {
    message =
      "Votre essai gratuit a expiré. Réactivez votre compte pour continuer.";
    cta = "Configurer le paiement";
  } else if (pastDue) {
    message =
      "Votre dernier paiement a échoué. Mettez à jour votre carte bancaire pour éviter la suspension.";
    cta = "Mettre à jour";
  } else if (trialDaysRemaining !== null && trialDaysRemaining > 0) {
    message = `Essai gratuit — Plus que ${trialDaysRemaining} jour${
      trialDaysRemaining > 1 ? "s" : ""
    }. Ajoutez votre carte bancaire pour ne rien perdre.`;
    cta = "Configurer le paiement";
  } else {
    message =
      "Votre essai se termine bientôt. Choisissez un plan pour conserver l'accès.";
    cta = "Voir les plans";
  }

  const tone =
    variant === "danger"
      ? "bg-red-600 text-white"
      : variant === "warning"
        ? "bg-orange-500 text-white"
        : "bg-yellow text-foreground";

  /**
   * Si on a un plan préféré on lance directement le checkout Stripe (pas
   * un détour par /settings/billing). Si pas de plan choisi, on renvoie
   * vers le pricing pour qu'il en sélectionne un.
   */
  async function startCheckout() {
    if (!intendedPlan || !isStripePlanId(intendedPlan)) {
      window.location.href = "/settings/billing";
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: intendedPlan,
          interval: intendedInterval === "annual" ? "year" : "month",
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur lors du checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPending(false);
    }
  }

  const showInlineCta =
    !pastDue &&
    intendedPlan !== null &&
    isStripePlanId(intendedPlan);

  return (
    <div
      className={`sticky top-0 z-30 ${tone} px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-3 flex-wrap`}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="text-center">{message}</span>
      {showInlineCta ? (
        <button
          type="button"
          onClick={startCheckout}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition-opacity disabled:opacity-60 cursor-pointer ${
            variant === "danger" || variant === "warning"
              ? "bg-white text-foreground hover:opacity-90"
              : "bg-foreground text-white hover:opacity-90"
          }`}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CreditCard className="h-3 w-3" />
          )}
          {cta}
        </button>
      ) : (
        <Link
          href="/settings/billing"
          className={`underline underline-offset-2 hover:opacity-80 transition-opacity ${
            variant === "danger" || variant === "warning"
              ? "text-white"
              : "text-foreground"
          }`}
        >
          {cta} &rarr;
        </Link>
      )}
      {error && (
        <span
          className={`text-xs ${
            variant === "danger" || variant === "warning"
              ? "text-white/90"
              : "text-foreground/80"
          }`}
        >
          {error}
        </span>
      )}
    </div>
  );
}
