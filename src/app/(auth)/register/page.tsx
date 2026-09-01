"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import {
  PasswordInput,
  PasswordStrengthBar,
} from "@/components/auth/password-input";
import {
  PLANS,
  isPlanId,
  isStripePlanId,
  type PlanId,
} from "@/lib/billing";

type IntervalAlias = "monthly" | "annual";

/**
 * Lightweight parser kept inline (the server `lib/billing.ts` exports
 * `normalizeBillingInterval` but it returns the canonical "month"/"year",
 * whereas we want to preserve the URL alias for downstream `?interval=`
 * propagation).
 */
function parseIntervalAlias(value: string | null): IntervalAlias {
  return value === "annual" ? "annual" : "monthly";
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-gray-500">Chargement...</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();

  const planParamRaw = params.get("plan");
  const planParam: PlanId | null = isPlanId(planParamRaw) ? planParamRaw : null;
  const intervalAlias: IntervalAlias = parseIntervalAlias(
    params.get("interval")
  );

  const [formData, setFormData] = useState<RegisterInput>({
    firstName: "",
    lastName: "",
    email: params.get("email") ?? "",
    password: "",
    confirmPassword: "",
    businessName: params.get("business") ?? "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterInput, string>>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setGeneralError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RegisterInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RegisterInput;
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            business_name: formData.businessName,
            role: "business_owner",
          },
        },
      });

      if (error) {
        const friendlyMessage =
          error.message.includes("already registered") ||
          error.message.includes("already been registered") ||
          error.message.includes("User already registered")
            ? "Un compte existe déjà avec cet email. Connectez-vous."
            : error.message.includes("Password should be") ||
                error.message.includes("password")
              ? "Le mot de passe doit contenir au moins 8 caractères."
              : error.message.includes("rate limit") || error.status === 429
                ? "Trop de tentatives. Réessayez dans quelques minutes."
                : error.message;
        setGeneralError(friendlyMessage);
        return;
      }

      // Persist the chosen plan so the dashboard banner / billing page
      // can pre-select it. Best-effort: never block signup on a write
      // failure (RLS, race with `handle_new_user` trigger, etc.).
      if (planParam && data.user) {
        try {
          await fetch("/api/account/intended-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan: planParam,
              interval: intervalAlias,
            }),
          });
        } catch {
          // silent — surfaced later via /settings/billing if needed.
        }
      }

      // If email confirmation is disabled, the user is immediately confirmed
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess(true);
      }
    } catch {
      setGeneralError(
        "Une erreur inattendue est survenue. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Vérifiez votre email
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Vérifiez votre email pour confirmer votre compte. Un lien de
          confirmation vous a été envoyé.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-black hover:underline"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  // Le plan est optionnel : l'inscription se fait sans choix de plan
  // préalable (le plan n'est affiché que si un `?plan=` valide est fourni).
  const planDescriptor = planParam ? PLANS[planParam] : null;
  const isEnterprise = planParam === "enterprise";
  const showCheckoutHint = planParam !== null && isStripePlanId(planParam);

  return (
    <div>
      {/* Plan banner — uniquement si l'utilisateur arrive avec un ?plan= */}
      {planDescriptor && (
        <div className="mb-6 rounded-xl border-2 border-foreground bg-yellow/30 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow text-foreground flex-shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {isEnterprise
                  ? `Vous démarrez avec le plan ${planDescriptor.name} (sur devis)`
                  : `Vous démarrez avec le plan ${planDescriptor.name}`}
              </p>
              <p className="mt-0.5 text-xs text-foreground/80">
                {showCheckoutHint
                  ? `Facturation ${
                      intervalAlias === "annual" ? "annuelle" : "mensuelle"
                    }`
                  : "Notre équipe vous contactera après votre inscription."}
              </p>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
        Créer votre compte
      </h1>

      {generalError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Prénom"
            name="firstName"
            placeholder="Jean"
            value={formData.firstName}
            onChange={handleChange}
            error={errors.firstName}
            autoComplete="given-name"
          />

          <Input
            label="Nom"
            name="lastName"
            placeholder="Dupont"
            value={formData.lastName}
            onChange={handleChange}
            error={errors.lastName}
            autoComplete="family-name"
          />
        </div>

        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="vous@exemple.com"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />

        <div className="space-y-1.5">
          <PasswordInput
            label="Mot de passe"
            name="password"
            placeholder="Minimum 8 caractères, dont 1 chiffre"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="new-password"
          />
          <PasswordStrengthBar password={formData.password} />
        </div>

        <PasswordInput
          label="Confirmer le mot de passe"
          name="confirmPassword"
          placeholder="Retapez votre mot de passe"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Input
          label="Nom de votre commerce"
          name="businessName"
          placeholder="Ma Boulangerie"
          value={formData.businessName}
          onChange={handleChange}
          error={errors.businessName}
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Créer mon compte
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-500">
          ou
        </span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <GoogleAuthButton next="/dashboard" label="S'inscrire avec Google" />

      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-black hover:underline">
          Connectez-vous
        </Link>
      </p>
    </div>
  );
}
