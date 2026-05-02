"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Password reset landing page. Reached from the email link sent by
 * `supabase.auth.resetPasswordForEmail` on /forgot-password.
 *
 * Supabase can deliver the recovery session in two ways depending on the
 * project config:
 *   1. Hash fragment (implicit flow):
 *      `#access_token=...&refresh_token=...&type=recovery`
 *   2. Query param (PKCE flow): `?code=...`
 *
 * We handle both: parse the hash and call `setSession`, or exchange the
 * `code`. Once the recovery session is active, `updateUser({ password })`
 * sets the new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // On mount: hydrate the recovery session from the URL.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();

      try {
        // 1) Hash fragment flow (most common with Supabase email templates).
        const hash =
          typeof window !== "undefined" ? window.location.hash : "";
        if (hash && hash.length > 1) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const type = params.get("type");
          const errorDescription = params.get("error_description");

          if (errorDescription) {
            if (!cancelled) {
              setLinkError(translateAuthError(errorDescription));
              setReady(true);
            }
            return;
          }

          if (accessToken && refreshToken && type === "recovery") {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              if (!cancelled) {
                setLinkError(translateAuthError(error.message));
                setReady(true);
              }
              return;
            }
            // Clean the URL — drop the tokens from the address bar.
            if (typeof window !== "undefined") {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname
              );
            }
            if (!cancelled) setReady(true);
            return;
          }
        }

        // 2) PKCE flow — `?code=...`.
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        if (search) {
          const sp = new URLSearchParams(search);
          const code = sp.get("code");
          const errorDescription = sp.get("error_description");
          if (errorDescription) {
            if (!cancelled) {
              setLinkError(translateAuthError(errorDescription));
              setReady(true);
            }
            return;
          }
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              if (!cancelled) {
                setLinkError(translateAuthError(error.message));
                setReady(true);
              }
              return;
            }
            if (typeof window !== "undefined") {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname
              );
            }
            if (!cancelled) setReady(true);
            return;
          }
        }

        // 3) Fallback : check if a session already exists (e.g. user navigated
        //    here directly while still authenticated). We allow it.
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          if (data.user) {
            setReady(true);
          } else {
            setLinkError(
              "Lien invalide ou expiré. Veuillez redemander un email de réinitialisation."
            );
            setReady(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLinkError(
            err instanceof Error
              ? translateAuthError(err.message)
              : "Une erreur est survenue lors de la validation du lien."
          );
          setReady(true);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setConfirmError(null);
    setGeneralError(null);

    if (password.length < 8) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setGeneralError(translateAuthError(error.message));
        toastError("Échec de la mise à jour du mot de passe");
        return;
      }

      setDone(true);
      toastSuccess("Mot de passe mis à jour");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch {
      setGeneralError("Une erreur inattendue est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="text-2xl sm:text-3xl font-bold text-black">
            aswallet
          </Link>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-5 sm:p-8">
          {!ready ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Vérification du lien…
            </div>
          ) : linkError ? (
            <div className="text-center">
              <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Lien invalide
              </h1>
              <p className="text-sm text-gray-600 mb-6">{linkError}</p>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-black hover:underline"
              >
                Redemander un lien de réinitialisation
              </Link>
            </div>
          ) : done ? (
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
                Mot de passe mis à jour
              </h2>
              <p className="text-sm text-gray-600">
                Redirection vers votre tableau de bord…
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                Choisissez un nouveau mot de passe
              </h1>
              <p className="text-center text-sm text-gray-600 mb-6">
                Saisissez votre nouveau mot de passe ci-dessous. Il doit
                contenir au moins 8 caractères.
              </p>

              {generalError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {generalError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    label="Nouveau mot de passe"
                    type={showPwd ? "text" : "password"}
                    name="password"
                    placeholder="Au moins 8 caractères"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(null);
                      setGeneralError(null);
                    }}
                    error={passwordError ?? undefined}
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-[34px] text-xs font-medium text-gray-500 hover:text-black transition-colors"
                    aria-label={
                      showPwd
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPwd ? "Masquer" : "Afficher"}
                  </button>
                </div>

                <Input
                  label="Confirmer le mot de passe"
                  type={showPwd ? "text" : "password"}
                  name="confirm"
                  placeholder="Retapez votre mot de passe"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setConfirmError(null);
                    setGeneralError(null);
                  }}
                  error={confirmError ?? undefined}
                  autoComplete="new-password"
                  minLength={8}
                />

                <Button
                  type="submit"
                  loading={loading}
                  className="w-full"
                  size="lg"
                >
                  Enregistrer le nouveau mot de passe
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
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6 sm:mt-8">
          aswallet &mdash; Fidélisez vos clients
        </p>
      </div>
    </div>
  );
}

/**
 * Translate common Supabase auth error messages into French copy. Falls back
 * to the original message when no match is found.
 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("expired") ||
    m.includes("invalid token") ||
    m.includes("token has expired") ||
    m.includes("otp_expired")
  ) {
    return "Ce lien a expiré. Veuillez redemander un email de réinitialisation.";
  }
  if (
    m.includes("invalid") &&
    (m.includes("token") || m.includes("link") || m.includes("grant"))
  ) {
    return "Lien invalide. Veuillez redemander un email de réinitialisation.";
  }
  if (m.includes("password") && m.includes("short")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (
    (m.includes("password") &&
      (m.includes("weak") || m.includes("breached") || m.includes("pwned"))) ||
    m.includes("weak_password")
  ) {
    return "Mot de passe trop faible. Choisissez-en un plus complexe.";
  }
  if (m.includes("same as the old password") || m.includes("new_password_should_be_different")) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Trop de tentatives. Veuillez réessayer dans quelques minutes.";
  }
  return message;
}
