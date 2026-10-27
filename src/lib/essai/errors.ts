import { NextResponse } from "next/server";
import type { EssaiErrorResponse } from "@/lib/essai/types";

/**
 * Erreur « métier » de la démo « Votre carte en 30 secondes ».
 *
 * Porte un message en français déjà présentable à l'utilisateur + le statut
 * HTTP à renvoyer. Les routes /api/essai/* la convertissent telle quelle en
 * `{ error }` ; toute autre exception est considérée comme interne (message
 * générique, détail seulement dans les logs) pour ne jamais exposer une
 * erreur technique (SQL, stack…) à un prospect.
 */
export class EssaiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EssaiError";
    this.status = status;
  }
}

export function isEssaiError(err: unknown): err is EssaiError {
  return err instanceof EssaiError;
}

/** Message générique quand une erreur interne survient. */
export const ESSAI_GENERIC_ERROR =
  "Un problème technique nous empêche de continuer. Réessayez dans un instant.";

export const ESSAI_NOT_FOUND_ERROR =
  "Cette carte d'essai est introuvable. Le lien est peut-être incomplet.";

/** Réponse JSON `{ error }` typée pour les routes /api/essai/*. */
export function essaiJsonError(
  message: string,
  status: number,
  headers?: HeadersInit
): NextResponse<EssaiErrorResponse> {
  return NextResponse.json<EssaiErrorResponse>(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } }
  );
}

/**
 * Convertit une exception en réponse : EssaiError → son message et son
 * statut ; tout le reste → 500 générique (détail uniquement dans les logs).
 */
export function essaiErrorResponse(
  err: unknown,
  logLabel: string
): NextResponse<EssaiErrorResponse> {
  if (isEssaiError(err)) return essaiJsonError(err.message, err.status);
  console.error(`[${logLabel}]`, err);
  return essaiJsonError(ESSAI_GENERIC_ERROR, 500);
}
