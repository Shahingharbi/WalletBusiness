"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setGeneralError(null);

    if (!email.trim()) {
      setEmailError("L'adresse email est requise");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setGeneralError(error.message);
        return;
      }

      setSuccess(true);
    } catch {
      setGeneralError("Une erreur inattendue est survenue. Veuillez réessayer.");
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
          Email envoyé
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Un email vous a été envoyé avec un lien pour réinitialiser votre mot
          de passe.
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
        Mot de passe oublié
      </h1>
      <p className="text-center text-sm text-gray-600 mb-6">
        Entrez votre adresse email et nous vous enverrons un lien pour
        réinitialiser votre mot de passe.
      </p>

      {generalError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          placeholder="vous@exemple.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
            setGeneralError(null);
          }}
          error={emailError ?? undefined}
          autoComplete="email"
        />

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Envoyer le lien de réinitialisation
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link
          href="/login"
          className="font-medium text-black hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
