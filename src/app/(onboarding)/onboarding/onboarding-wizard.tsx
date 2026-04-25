"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Store,
  Users,
  BellRing,
  LayoutDashboard,
  CreditCard,
  Printer,
  Loader2,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  firstName: string;
  businessName: string;
  initialStep: number;
  initialData: Record<string, string> | null;
  cardId: string | null;
  cardName: string | null;
}

const COMMERCE_TYPES = [
  { value: "kebab", label: "Kebab / Snack" },
  { value: "boulangerie", label: "Boulangerie" },
  { value: "cafe", label: "Café / Salon de thé" },
  { value: "restaurant", label: "Restaurant" },
  { value: "coiffeur", label: "Coiffeur / Barbier" },
  { value: "fleuriste", label: "Fleuriste" },
  { value: "autre", label: "Autre" },
];

const GOAL_OPTIONS = [
  { value: "fidelisation", label: "Fidéliser mes clients", icon: Users },
  { value: "push", label: "Envoyer des notifications push", icon: BellRing },
  { value: "dashboard", label: "Suivre mes clients en direct", icon: LayoutDashboard },
];

const ESTIMATED_RANGES = [
  { value: "0-50", label: "Moins de 50" },
  { value: "50-200", label: "50 à 200" },
  { value: "200-500", label: "200 à 500" },
  { value: "500+", label: "Plus de 500" },
];

const STEPS = [
  { id: 1, label: "Bienvenue" },
  { id: 2, label: "Première carte" },
  { id: 3, label: "Imprimer" },
] as const;

export function OnboardingWizard({
  firstName,
  businessName,
  initialStep,
  initialData,
  cardId,
  cardName,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<number>(initialStep);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<string>(initialData?.type ?? "");
  const [estimatedClients, setEstimatedClients] = useState<string>(
    initialData?.estimated_clients ?? ""
  );
  const [goal, setGoal] = useState<string>(initialData?.goal ?? "");

  const saveAnswers = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          estimated_clients: estimatedClients,
          goal,
        }),
      });
      if (!res.ok) throw new Error("Sauvegarde impossible");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const completeOnboarding = async (redirectTo: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          estimated_clients: estimatedClients,
          goal,
        }),
      });
      if (!res.ok) throw new Error("Finalisation impossible");
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
      setSubmitting(false);
    }
  };

  const handleStep1Continue = async () => {
    try {
      await saveAnswers();
      setStep(2);
    } catch {
      // error displayed
    }
  };

  const goToCardCreation = async () => {
    try {
      await saveAnswers();
    } catch {
      return;
    }
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    params.set("from", "onboarding");
    router.push(`/cards/new?${params.toString()}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  step > s.id
                    ? "border-foreground bg-foreground text-white"
                    : step === s.id
                      ? "border-foreground bg-yellow text-foreground"
                      : "border-gray-300 bg-white text-gray-400"
                )}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[11px] sm:text-xs font-medium",
                  step >= s.id ? "text-foreground" : "text-gray-400"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-12 sm:w-24 mx-2 mb-5 transition-colors",
                  step > s.id ? "bg-foreground" : "bg-gray-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <Step1
          firstName={firstName}
          businessName={businessName}
          type={type}
          setType={setType}
          estimatedClients={estimatedClients}
          setEstimatedClients={setEstimatedClients}
          goal={goal}
          setGoal={setGoal}
          submitting={submitting}
          onContinue={handleStep1Continue}
          onSkipAll={() => completeOnboarding("/dashboard")}
        />
      )}

      {step === 2 && (
        <Step2
          submitting={submitting}
          onBack={() => setStep(1)}
          onCreate={goToCardCreation}
          onSkip={() => setStep(3)}
          onSkipAll={() => completeOnboarding("/dashboard")}
          alreadyHasCard={!!cardId}
          cardName={cardName}
        />
      )}

      {step === 3 && (
        <Step3
          cardId={cardId}
          cardName={cardName}
          submitting={submitting}
          onBack={() => setStep(2)}
          onFinish={() => completeOnboarding("/dashboard")}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------- */
/*  Step 1 — Bienvenue                                */
/* -------------------------------------------------- */
function Step1({
  firstName,
  businessName,
  type,
  setType,
  estimatedClients,
  setEstimatedClients,
  goal,
  setGoal,
  submitting,
  onContinue,
  onSkipAll,
}: {
  firstName: string;
  businessName: string;
  type: string;
  setType: (v: string) => void;
  estimatedClients: string;
  setEstimatedClients: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
  submitting: boolean;
  onContinue: () => void;
  onSkipAll: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-beige-dark p-6 sm:p-10 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow mb-4">
          <Sparkles className="h-7 w-7 text-foreground" />
        </div>
        <h1
          className="text-3xl sm:text-4xl text-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
        >
          Vous y êtes presque{firstName ? `, ${firstName}` : ""} !
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Quelques questions rapides pour personnaliser votre expérience pour{" "}
          <span className="font-semibold text-foreground">
            {businessName || "votre commerce"}
          </span>
          . Toutes optionnelles.
        </p>
      </div>

      <div className="space-y-6">
        {/* Type de commerce */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            <Store className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Type de commerce
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10"
          >
            <option value="">Sélectionnez votre activité…</option>
            {COMMERCE_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Nombre estime */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Nombre estimé de clients par mois
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ESTIMATED_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setEstimatedClients(r.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                  estimatedClients === r.value
                    ? "border-foreground bg-foreground text-white"
                    : "border-gray-200 bg-white text-foreground hover:border-foreground/40"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Objectif */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Que recherchez-vous en priorité ?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {GOAL_OPTIONS.map((g) => {
              const Icon = g.icon;
              const active = goal === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-all cursor-pointer flex flex-col gap-2",
                    active
                      ? "border-foreground bg-yellow/30"
                      : "border-gray-200 bg-white hover:border-foreground/40"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {g.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-10 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={onSkipAll}
          disabled={submitting}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Passer l&apos;onboarding
        </button>
        <Button onClick={onContinue} loading={submitting} size="lg">
          Continuer
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/*  Step 2 — Carte                                    */
/* -------------------------------------------------- */
function Step2({
  submitting,
  onBack,
  onCreate,
  onSkip,
  onSkipAll,
  alreadyHasCard,
  cardName,
}: {
  submitting: boolean;
  onBack: () => void;
  onCreate: () => void;
  onSkip: () => void;
  onSkipAll: () => void;
  alreadyHasCard: boolean;
  cardName: string | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-beige-dark p-6 sm:p-10 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow mb-4">
          <CreditCard className="h-7 w-7 text-foreground" />
        </div>
        <h2
          className="text-2xl sm:text-3xl text-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
        >
          Créer ma première carte de fidélité
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          {alreadyHasCard ? (
            <>
              Vous avez déjà créé{" "}
              <span className="font-semibold text-foreground">
                {cardName ?? "une carte"}
              </span>
              . Passez à l&apos;impression du QR code !
            </>
          ) : (
            <>
              C&apos;est l&apos;étape clé : on va créer la carte que vos clients
              ajouteront à leur Wallet. Pré-remplissage selon votre activité.
            </>
          )}
        </p>
      </div>

      <ul className="space-y-3 max-w-md mx-auto mb-8">
        {[
          "Choix d'un modèle adapté à votre commerce",
          "Personnalisation des couleurs et du logo",
          "Définition de la récompense (ex : 1 menu offert)",
        ].map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-foreground">
            <Check className="h-5 w-5 text-yellow-hover bg-foreground rounded-full p-1 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-8 pt-6 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="ghost" onClick={onBack} disabled={submitting}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <button
            type="button"
            onClick={onSkipAll}
            disabled={submitting}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Plus tard
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {alreadyHasCard ? (
            <Button onClick={onSkip} disabled={submitting} size="lg">
              Étape suivante
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={onCreate} loading={submitting} size="lg">
              Créer ma carte
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------- */
/*  Step 3 — Affiche                                  */
/* -------------------------------------------------- */
function Step3({
  cardId,
  cardName,
  submitting,
  onBack,
  onFinish,
}: {
  cardId: string | null;
  cardName: string | null;
  submitting: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!cardId) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/onboarding/poster/${cardId}`);
      if (!res.ok) throw new Error("Téléchargement impossible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `affiche-fidelite-${cardName?.toLowerCase().replace(/\s+/g, "-") ?? "carte"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(
        e instanceof Error ? e.message : "Une erreur est survenue"
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-beige-dark p-6 sm:p-10 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow mb-4">
          <Printer className="h-7 w-7 text-foreground" />
        </div>
        <h2
          className="text-2xl sm:text-3xl text-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
        >
          Imprimer mon QR code
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Téléchargez votre affiche prête à imprimer (A4) et placez-la sur votre
          comptoir. Vos clients scannent et ajoutent la carte à leur Wallet.
        </p>
      </div>

      {downloadError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      {cardId ? (
        <div className="bg-beige rounded-xl p-6 mb-6 text-center">
          <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
            Carte sélectionnée
          </p>
          <p className="text-lg font-bold text-foreground">
            {cardName ?? "Votre carte"}
          </p>
          <Button
            onClick={handleDownload}
            loading={downloading}
            size="lg"
            className="mt-4 mx-auto"
          >
            <Printer className="h-4 w-4 mr-2" />
            Télécharger le PDF
          </Button>
        </div>
      ) : (
        <div className="bg-beige rounded-xl p-6 mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;avez pas encore créé de carte.
          </p>
          <Link href="/cards/new?from=onboarding">
            <Button className="mt-3" size="lg">
              Créer une carte d&apos;abord
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mt-8 pt-6 border-t border-gray-100">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button onClick={onFinish} loading={submitting} size="lg">
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Terminer l&apos;onboarding
        </Button>
      </div>
    </div>
  );
}
