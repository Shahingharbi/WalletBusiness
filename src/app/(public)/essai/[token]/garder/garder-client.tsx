"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, LoaderCircle, MessageCircle, RotateCcw } from "lucide-react";
import { whatsappHref } from "@/lib/contact";
import type { EssaiClaimResponse, EssaiErrorResponse } from "@/lib/essai/types";

interface GarderClientProps {
  token: string;
  name: string;
  logoUrl: string | null;
  background: string;
  accent: string;
  essaiPageUrl: string;
}

type Phase =
  | { kind: "working" }
  | { kind: "done" }
  | { kind: "error"; message: string; status: number };

/** Étapes affichées pendant la copie (rythme réaliste : ~1 à 3 s en tout). */
const STEPS = [
  "Copie de votre carte",
  "Logo, couleurs et récompense",
  "Ouverture de votre espace",
];
const STEP_INTERVAL_MS = 900;

const NETWORK_ERROR =
  "Connexion impossible. Vérifiez votre réseau puis réessayez.";
const GENERIC_ERROR =
  "Un problème technique nous empêche de continuer. Réessayez dans un instant.";

type ClaimOutcome =
  | { kind: "ok"; cardId: string }
  | { kind: "auth" }
  | { kind: "error"; message: string; status: number };

/** POST /api/essai/<token>/claim — ne touche à aucun état React. */
async function requestClaim(token: string): Promise<ClaimOutcome> {
  try {
    const res = await fetch(`/api/essai/${encodeURIComponent(token)}/claim`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401) return { kind: "auth" };

    const data = (await res.json().catch(() => null)) as
      | EssaiClaimResponse
      | EssaiErrorResponse
      | null;
    if (res.ok && data && "ok" in data && data.ok) {
      return { kind: "ok", cardId: data.cardId };
    }
    const message =
      data && "error" in data && typeof data.error === "string" && data.error
        ? data.error
        : GENERIC_ERROR;
    return { kind: "error", message, status: res.status };
  } catch {
    return { kind: "error", message: NETWORK_ERROR, status: 0 };
  }
}

export function GarderClient({
  token,
  name,
  logoUrl,
  background,
  accent,
  essaiPageUrl,
}: GarderClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const [step, setStep] = useState(0);
  // Garde-fou : en développement, React StrictMode monte deux fois les
  // effets. Le serveur est idempotent, mais un seul appel suffit.
  const started = useRef(false);

  /** Applique le résultat du serveur (appelé dans un callback de promesse). */
  const applyOutcome = useCallback(
    (outcome: ClaimOutcome) => {
      if (outcome.kind === "auth") {
        // Session expirée entre-temps : retour à l'inscription / connexion.
        router.replace(`/register?essai=${encodeURIComponent(token)}`);
        return;
      }
      if (outcome.kind === "ok") {
        setStep(STEPS.length);
        setPhase({ kind: "done" });
        router.replace(`/cards/${outcome.cardId}?essai=1`);
        return;
      }
      setPhase({ kind: "error", message: outcome.message, status: outcome.status });
    },
    [router, token]
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void requestClaim(token).then(applyOutcome);
  }, [token, applyOutcome]);

  const retry = () => {
    setPhase({ kind: "working" });
    setStep(0);
    void requestClaim(token).then(applyOutcome);
  };

  // Progression des étapes pendant l'attente (la dernière reste « en cours »
  // tant que le serveur n'a pas répondu).
  useEffect(() => {
    if (phase.kind !== "working") return;
    const id = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [phase.kind]);

  const whatsappText = `Bonjour, je souhaite garder ma carte de fidélité « ${name} » créée sur aswallet : ${essaiPageUrl}`;
  const initials = name.trim().charAt(0).toUpperCase() || "A";

  return (
    <section className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white p-6 text-center shadow-xl sm:p-8">
        {/* Logo de la carte, entouré d'un anneau animé pendant la copie */}
        <div className="relative mx-auto mb-6 h-28 w-28">
          {phase.kind === "working" && (
            <span
              aria-hidden
              className="absolute inset-0 animate-spin rounded-[2rem] border-4 border-transparent"
              style={{ borderTopColor: accent, borderRightColor: accent, animationDuration: "1.4s" }}
            />
          )}
          <div
            className="absolute inset-2 flex items-center justify-center overflow-hidden rounded-[1.6rem] shadow-md"
            style={{ backgroundColor: background }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo distant (Supabase), petite vignette
              <img src={logoUrl} alt={`Logo ${name}`} className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-3xl font-bold" style={{ color: accent }}>
                {initials}
              </span>
            )}
          </div>
          {phase.kind === "done" && (
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-white">
              <Check className="h-5 w-5" aria-hidden />
            </span>
          )}
        </div>

        {phase.kind === "error" ? (
          <div role="alert">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <CircleAlert className="h-5 w-5 text-red-600" aria-hidden />
            </div>
            <h1
              className="text-xl text-foreground sm:text-2xl"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              Votre carte n&apos;a pas pu être ajoutée
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{phase.message}</p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={retry}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow px-6 text-sm font-semibold text-foreground transition-colors hover:bg-yellow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Réessayer
              </button>
              {phase.status === 402 && (
                <Link
                  href="/settings/billing"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-foreground px-6 text-sm font-semibold text-foreground transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  Voir les offres
                </Link>
              )}
              <a
                href={whatsappHref(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-white px-6 text-sm font-semibold text-foreground transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden />
                On s&apos;en occupe pour vous sur WhatsApp
              </a>
            </div>

            <Link
              href={`/essai/${encodeURIComponent(token)}`}
              className="mt-5 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Revenir à ma carte d&apos;essai
            </Link>
          </div>
        ) : (
          <div>
            <h1
              className="text-xl text-foreground sm:text-2xl"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              {phase.kind === "done" ? "C'est fait !" : "On installe votre carte…"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              «&nbsp;{name}&nbsp;» rejoint votre espace aswallet.
            </p>

            <ol className="mx-auto mt-6 max-w-xs space-y-3 text-left" aria-live="polite">
              {STEPS.map((label, i) => {
                const doneStep = i < step || phase.kind === "done";
                const current = i === step && phase.kind === "working";
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                        doneStep
                          ? "bg-emerald-500 text-white"
                          : current
                            ? "bg-yellow text-foreground"
                            : "bg-gray-100 text-gray-400"
                      }`}
                      aria-hidden
                    >
                      {doneStep ? (
                        <Check className="h-4 w-4" />
                      ) : current ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-xs font-semibold">{i + 1}</span>
                      )}
                    </span>
                    <span className={doneStep || current ? "text-foreground" : "text-gray-400"}>
                      {label}
                      {current && <span className="sr-only"> — en cours</span>}
                      {doneStep && <span className="sr-only"> — terminé</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
