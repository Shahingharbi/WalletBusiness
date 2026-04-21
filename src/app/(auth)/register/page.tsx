"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-gray-500">Chargement...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [formData, setFormData] = useState<RegisterInput>({
    firstName: "",
    lastName: "",
    email: params.get("email") ?? "",
    password: "",
    businessName: params.get("business") ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
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
        setGeneralError(error.message);
        return;
      }

      // If email confirmation is disabled, the user is immediately confirmed
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess(true);
      }
    } catch {
      setGeneralError("Une erreur inattendue est survenue. Veuillez reessayer.");
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Verifiez votre email
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Verifiez votre email pour confirmer votre compte. Un lien de
          confirmation vous a ete envoye.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-black hover:underline"
        >
          Retour a la connexion
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
        Creer votre compte
      </h1>

      {generalError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Prenom"
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

        <Input
          label="Mot de passe"
          type="password"
          name="password"
          placeholder="Minimum 6 caracteres"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
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
          Creer mon compte
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-500">ou</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <GoogleAuthButton next="/dashboard" label="S'inscrire avec Google" />

      <p className="mt-6 text-center text-sm text-gray-600">
        Deja un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-black hover:underline"
        >
          Connectez-vous
        </Link>
      </p>
    </div>
  );
}
