import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface BillingBannerProps {
  variant: "warning" | "danger";
  locked: boolean;
  pastDue: boolean;
  trialDaysRemaining: number | null;
}

export function BillingBanner({
  variant,
  locked,
  pastDue,
  trialDaysRemaining,
}: BillingBannerProps) {
  let message: string;
  let cta: string;

  if (locked) {
    message =
      "Votre essai gratuit a expiré. Choisissez un plan pour continuer à utiliser aswallet.";
    cta = "Choisir un plan";
  } else if (pastDue) {
    message =
      "Votre dernier paiement a échoué. Mettez à jour votre carte bancaire pour éviter la suspension.";
    cta = "Mettre à jour";
  } else if (trialDaysRemaining !== null && trialDaysRemaining > 0) {
    message = `Votre essai gratuit se termine dans ${trialDaysRemaining} jour${
      trialDaysRemaining > 1 ? "s" : ""
    }. Choisissez un plan pour conserver l'accès.`;
    cta = "Voir les plans";
  } else {
    message =
      "Votre essai se termine bientôt. Choisissez un plan pour conserver l'accès.";
    cta = "Voir les plans";
  }

  const tone =
    variant === "danger"
      ? "bg-red-600 text-white"
      : "bg-yellow text-foreground";

  return (
    <div
      className={`sticky top-0 z-30 ${tone} px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-3 flex-wrap`}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="text-center">{message}</span>
      <Link
        href="/settings/billing"
        className={`underline underline-offset-2 hover:opacity-80 transition-opacity ${
          variant === "danger" ? "text-white" : "text-foreground"
        }`}
      >
        {cta} &rarr;
      </Link>
    </div>
  );
}
