/**
 * Demande d'avis Google automatique après un passage en caisse.
 *
 * Réglages stockés par carte dans `cards.auto_push_settings.google_review`
 * (JSONB, migration 007). Envoi par le cron `/api/cron/review-requests`
 * (toutes les minutes), une seule fois par client (index unique partiel,
 * migration 014).
 *
 * Pure logic — safe to import from server or client.
 */

export interface GoogleReviewSettings {
  enabled: boolean;
  /** Lien direct vers le formulaire d'avis Google (https). */
  url: string;
  /** Texte de la notification — le lien est ajouté automatiquement à la fin. */
  message: string;
  /** Délai entre le scan et l'envoi, en minutes. */
  delay_minutes: number;
}

export const REVIEW_DELAY_OPTIONS = [3, 10, 30, 60] as const;
export const REVIEW_DEFAULT_DELAY = 3;
export const REVIEW_MESSAGE_MAX = 150;
export const REVIEW_URL_MAX = 150;
export const REVIEW_DEFAULT_MESSAGE =
  "Merci pour votre visite {name} ! ⭐ Un petit avis Google nous aiderait énormément :";

/**
 * Longueur max du message complet (texte + lien). `syncLoyaltyObject`
 * tronque le body Google à 200 caractères : on réserve la place du lien
 * pour qu'il ne soit jamais coupé.
 */
const FULL_MESSAGE_MAX = 200;

export function isValidReviewUrl(url: string): boolean {
  if (!url || url.length > REVIEW_URL_MAX) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeDelay(value: unknown): number {
  const n = Number(value);
  return (REVIEW_DELAY_OPTIONS as readonly number[]).includes(n)
    ? n
    : REVIEW_DEFAULT_DELAY;
}

/**
 * Valide les réglages envoyés par le dashboard. Un lien est obligatoire
 * pour activer la demande ; un lien saisi mais invalide est refusé même
 * quand la demande est désactivée (évite de stocker n'importe quoi).
 */
export function sanitizeGoogleReview(
  input: unknown
): { value?: GoogleReviewSettings; error?: string } {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  const enabled = o.enabled === true;

  if ((enabled || url) && !isValidReviewUrl(url)) {
    return {
      error:
        "Lien d'avis Google invalide : il doit commencer par https:// (150 caractères max).",
    };
  }

  return {
    value: {
      enabled,
      url,
      message:
        typeof o.message === "string"
          ? o.message.trim().slice(0, REVIEW_MESSAGE_MAX)
          : "",
      delay_minutes: normalizeDelay(o.delay_minutes),
    },
  };
}

/** Réglages lus depuis `cards.auto_push_settings` (JSONB non typé). */
export function readGoogleReview(
  autoPushSettings: unknown
): GoogleReviewSettings | null {
  const gr = (autoPushSettings as { google_review?: unknown } | null)
    ?.google_review;
  if (!gr || typeof gr !== "object") return null;
  const o = gr as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    url: typeof o.url === "string" ? o.url.trim() : "",
    message: typeof o.message === "string" ? o.message : "",
    delay_minutes: normalizeDelay(o.delay_minutes),
  };
}

/** Lien d'avis si la demande est activée avec un lien valide, sinon null. */
export function activeReviewUrl(autoPushSettings: unknown): string | null {
  const gr = readGoogleReview(autoPushSettings);
  if (!gr?.enabled || !isValidReviewUrl(gr.url)) return null;
  return gr.url;
}

/**
 * Message final : template (avec `{name}`) + lien à la fin. Le texte est
 * raccourci si besoin pour que le lien tienne toujours en entier.
 */
export function buildReviewMessage(
  template: string,
  url: string,
  firstName?: string | null
): string {
  const room = Math.max(0, FULL_MESSAGE_MAX - url.length - 1);
  const text = (template.trim() || REVIEW_DEFAULT_MESSAGE)
    .replace(/\{name\}/gi, firstName?.trim() ?? "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, Math.min(REVIEW_MESSAGE_MAX, room))
    .trim();
  return text ? `${text} ${url}` : url;
}
