"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanId, BillingInterval } from "@/lib/billing";

export interface InvoiceRow {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

interface PlanInfo {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
}

interface BillingClientProps {
  successFlag: boolean;
  canceledFlag: boolean;
  currentPlan: PlanId | null;
  subscriptionStatus: string | null;
  subscriptionInterval: BillingInterval;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  inTrial: boolean;
  trialDaysRemaining: number | null;
  lockedOut: boolean;
  hasStripeCustomer: boolean;
  invoices: InvoiceRow[];
  plans: PlanInfo[];
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Essai gratuit",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  incomplete: "Incomplet",
  incomplete_expired: "Expiré",
  unpaid: "Impayé",
  paused: "En pause",
};

function formatDate(input: string | null | number): string {
  if (input === null || input === undefined || input === "") return "—";
  const date =
    typeof input === "number" ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function BillingClient(props: BillingClientProps) {
  const {
    successFlag,
    canceledFlag,
    currentPlan,
    subscriptionStatus,
    subscriptionInterval,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    trialEndsAt,
    inTrial,
    trialDaysRemaining,
    lockedOut,
    hasStripeCustomer,
    invoices,
    plans,
  } = props;

  const [interval, setInterval] = useState<BillingInterval>(
    subscriptionInterval
  );
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [pendingPortal, setPendingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPastDue = subscriptionStatus === "past_due";

  async function startCheckout(plan: PlanId) {
    setError(null);
    setPendingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur lors du checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPendingPlan(null);
    }
  }

  async function openPortal() {
    setError(null);
    setPendingPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur lors de l'ouverture du portail");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPendingPortal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Banners */}
      {successFlag && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-start gap-3">
          <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Paiement confirmé</p>
            <p className="mt-1">
              Votre abonnement est actif. Le statut peut prendre quelques
              secondes à se mettre à jour.
            </p>
          </div>
        </div>
      )}
      {canceledFlag && (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          Paiement annulé. Aucun montant n&apos;a été prélevé.
        </div>
      )}
      {isPastDue && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Votre paiement a échoué</p>
            <p className="mt-1">
              Mettez à jour votre carte bancaire pour éviter la suspension de
              votre abonnement.
            </p>
          </div>
          <Button
            onClick={openPortal}
            loading={pendingPortal}
            variant="destructive"
            size="sm"
          >
            Mettre à jour
          </Button>
        </div>
      )}
      {!isPastDue &&
        inTrial &&
        trialDaysRemaining !== null &&
        trialDaysRemaining <= 3 && (
          <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                Votre essai se termine dans{" "}
                {trialDaysRemaining <= 0
                  ? "moins d'un jour"
                  : `${trialDaysRemaining} jour${trialDaysRemaining > 1 ? "s" : ""}`}
              </p>
              <p className="mt-1">
                Choisissez un plan ci-dessous pour conserver l&apos;accès à vos
                cartes et clients.
              </p>
            </div>
          </div>
        )}
      {lockedOut && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Votre essai gratuit a expiré</p>
            <p className="mt-1">
              Choisissez un plan pour continuer à utiliser aswallet. Vos
              données sont conservées.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Current plan card */}
      <section className="rounded-2xl border border-beige-dark bg-white p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
              Formule actuelle
            </p>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentPlan
                  ? plans.find((p) => p.id === currentPlan)?.name ?? "—"
                  : inTrial
                    ? "Essai gratuit"
                    : "Aucun abonnement"}
              </h2>
              {subscriptionStatus && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    subscriptionStatus === "active" ||
                    subscriptionStatus === "trialing"
                      ? "bg-green-100 text-green-800"
                      : subscriptionStatus === "past_due"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {STATUS_LABELS[subscriptionStatus] ?? subscriptionStatus}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {currentPlan ? (
                cancelAtPeriodEnd ? (
                  <>
                    Annulation programmée le{" "}
                    <strong>{formatDate(currentPeriodEnd)}</strong>.
                  </>
                ) : (
                  <>
                    Prochain renouvellement le{" "}
                    <strong>{formatDate(currentPeriodEnd)}</strong>{" "}
                    ({interval === "year" ? "facturation annuelle" : "facturation mensuelle"})
                  </>
                )
              ) : inTrial ? (
                <>
                  Fin de l&apos;essai le{" "}
                  <strong>{formatDate(trialEndsAt)}</strong>
                  {trialDaysRemaining !== null && trialDaysRemaining > 0
                    ? ` (encore ${trialDaysRemaining} jour${trialDaysRemaining > 1 ? "s" : ""})`
                    : ""}
                </>
              ) : (
                <>Choisissez un plan pour activer votre commerce.</>
              )}
            </p>
          </div>
          {hasStripeCustomer && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                onClick={openPortal}
                loading={pendingPortal}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Gérer le mode de paiement
              </Button>
              {currentPlan && !cancelAtPeriodEnd && (
                <Button
                  variant="ghost"
                  onClick={openPortal}
                  loading={pendingPortal}
                >
                  Annuler l&apos;abonnement
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Plans grid */}
      <section className="rounded-2xl border border-beige-dark bg-white p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900">
            {currentPlan ? "Changer de plan" : "Choisir un plan"}
          </h2>
          <div className="inline-flex rounded-full bg-beige p-1 text-sm">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`px-4 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
                interval === "month"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-gray-600 hover:text-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`px-4 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
                interval === "year"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-gray-600 hover:text-foreground"
              }`}
            >
              Annuel <span className="text-xs text-green-700">−20%</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent =
              currentPlan === plan.id && interval === subscriptionInterval;
            const price =
              interval === "year" ? plan.yearlyPrice : plan.monthlyPrice;
            const ctaLabel = isCurrent
              ? "Plan actuel"
              : currentPlan
                ? "Choisir ce plan"
                : "Souscrire";
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 p-5 flex flex-col ${
                  plan.id === "pro"
                    ? "border-foreground"
                    : "border-beige-dark"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <h3 className="text-lg font-bold text-gray-900">
                    {plan.name}
                  </h3>
                  {plan.id === "pro" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-foreground bg-yellow px-2 py-0.5 rounded-full">
                      <Sparkles className="h-3 w-3" />
                      Populaire
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    {price}
                  </span>
                  <span className="text-sm text-gray-500">EUR/mois</span>
                </div>
                {interval === "year" && (
                  <p className="text-xs text-green-700 mt-1">
                    Facturé annuellement
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  {plan.description}
                </p>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {plan.features.slice(0, 5).map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs text-gray-700"
                    >
                      <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => startCheckout(plan.id)}
                  disabled={isCurrent || pendingPlan !== null}
                  loading={pendingPlan === plan.id}
                  variant={plan.id === "pro" ? "default" : "secondary"}
                  className="mt-4 w-full"
                >
                  {ctaLabel}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoices */}
      {invoices.length > 0 && (
        <section className="rounded-2xl border border-beige-dark bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Historique des factures
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Numéro</th>
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="pb-2 pr-3 font-semibold">Montant</th>
                  <th className="pb-2 pr-3 font-semibold">Statut</th>
                  <th className="pb-2 font-semibold text-right">Téléchargement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-dark">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="text-gray-800">
                    <td className="py-3 pr-3 font-mono text-xs">
                      {inv.number ?? inv.id.slice(0, 12)}
                    </td>
                    <td className="py-3 pr-3">{formatDate(inv.created)}</td>
                    <td className="py-3 pr-3">
                      {formatAmount(inv.amountPaid, inv.currency)}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`text-xs font-semibold ${
                          inv.status === "paid"
                            ? "text-green-700"
                            : inv.status === "open"
                              ? "text-yellow-700"
                              : "text-gray-600"
                        }`}
                      >
                        {inv.status ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-3">
                        {inv.invoicePdf && (
                          <a
                            href={inv.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:opacity-70 inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </a>
                        )}
                        {inv.hostedInvoiceUrl && (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:opacity-70 inline-flex items-center gap-1 text-xs font-semibold"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Voir
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pendingPlan && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 flex items-center gap-3 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            <span className="text-sm font-semibold text-gray-900">
              Redirection vers Stripe…
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
