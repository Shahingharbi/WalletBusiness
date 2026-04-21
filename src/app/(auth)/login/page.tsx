"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginInput>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
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

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LoginInput;
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
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setGeneralError(
          error.message === "Invalid login credentials"
            ? "Email ou mot de passe incorrect"
            : error.message
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setGeneralError("Une erreur inattendue est survenue. Veuillez reessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
        Connexion
      </h1>

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
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />

        <Input
          label="Mot de passe"
          type="password"
          name="password"
          placeholder="Votre mot de passe"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Mot de passe oublie ?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Se connecter
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-500">ou</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <GoogleAuthButton next="/dashboard" label="Continuer avec Google" />

      <p className="mt-6 text-center text-sm text-gray-600">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-black hover:underline"
        >
          Inscrivez-vous
        </Link>
      </p>
    </div>
  );
}
