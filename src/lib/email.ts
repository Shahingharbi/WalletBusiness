/**
 * Resend email wrapper.
 *
 * Server-only. Do NOT import from client components.
 *
 * Usage:
 *   await sendEmail({
 *     to: "merchant@example.com",
 *     template: "welcome",
 *     data: { firstName: "Jean", dashboardUrl: "..." },
 *   });
 *
 * The discriminated union enforces that the data shape matches the chosen
 * template at compile time.
 */

// Server-only: do NOT import from client components. (We avoid the
// "server-only" package since it isn't installed; importing the Resend
// SDK from a client component would already fail at bundle time.)
import * as React from "react";
import { Resend } from "resend";
import { CardInstalledEmail } from "@/emails/card-installed";
import { InvoicePaymentFailedEmail } from "@/emails/invoice-payment-failed";
import { PasswordResetEmail } from "@/emails/password-reset";
import { RewardEarnedEmail } from "@/emails/reward-earned";
import { TrialExpiresSoonEmail } from "@/emails/trial-expires-soon";
import { WelcomeEmail } from "@/emails/welcome";
import type { CardInstalledEmailProps } from "@/emails/card-installed";
import type { InvoicePaymentFailedEmailProps } from "@/emails/invoice-payment-failed";
import type { PasswordResetEmailProps } from "@/emails/password-reset";
import type { RewardEarnedEmailProps } from "@/emails/reward-earned";
import type { TrialExpiresSoonEmailProps } from "@/emails/trial-expires-soon";
import type { WelcomeEmailProps } from "@/emails/welcome";

export type EmailTemplate =
  | { template: "welcome"; data: WelcomeEmailProps }
  | { template: "password-reset"; data: PasswordResetEmailProps }
  | { template: "card-installed"; data: CardInstalledEmailProps }
  | { template: "reward-earned"; data: RewardEarnedEmailProps }
  | { template: "trial-expires-soon"; data: TrialExpiresSoonEmailProps }
  | { template: "invoice-payment-failed"; data: InvoicePaymentFailedEmailProps };

export type SendEmailArgs = EmailTemplate & {
  to: string | string[];
  subject?: string;
  /** Optional override for the From address. */
  from?: string;
  /** Optional override for the Reply-To address. */
  replyTo?: string;
};

const SUBJECTS: Record<EmailTemplate["template"], string> = {
  welcome: "Bienvenue chez aswallet",
  "password-reset": "Réinitialisez votre mot de passe aswallet",
  "card-installed": "Un nouveau client a installé votre carte",
  "reward-earned": "Bravo, une récompense vient d'être débloquée !",
  "trial-expires-soon": "Votre essai gratuit aswallet expire bientôt",
  "invoice-payment-failed": "Action requise — paiement aswallet échoué",
};

function renderTemplate(args: EmailTemplate): React.ReactElement {
  switch (args.template) {
    case "welcome":
      return React.createElement(WelcomeEmail, args.data);
    case "password-reset":
      return React.createElement(PasswordResetEmail, args.data);
    case "card-installed":
      return React.createElement(CardInstalledEmail, args.data);
    case "reward-earned":
      return React.createElement(RewardEarnedEmail, args.data);
    case "trial-expires-soon":
      return React.createElement(TrialExpiresSoonEmail, args.data);
    case "invoice-payment-failed":
      return React.createElement(InvoicePaymentFailedEmail, args.data);
  }
}

let cachedClient: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

/**
 * Send a transactional email through Resend.
 *
 * Returns `{ ok: true, id }` on success, `{ ok: false, error }` on failure
 * or if Resend is not configured. Never throws — callers can fire-and-forget
 * or surface the error in their own logging stack (Sentry).
 */
export async function sendEmail(args: SendEmailArgs): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const resend = getResend();
  if (!resend) {
    const message = "[email] RESEND_API_KEY is not set — skipping send.";
    // eslint-disable-next-line no-console
    console.warn(message);
    return { ok: false, error: message };
  }

  const from = args.from ?? process.env.EMAIL_FROM ?? "aswallet <hello@aswallet.fr>";
  const replyTo =
    args.replyTo ?? process.env.EMAIL_REPLY_TO ?? "contact@aswallet.fr";
  const subject = args.subject ?? SUBJECTS[args.template];

  try {
    const result = await resend.emails.send({
      from,
      to: args.to,
      replyTo,
      subject,
      react: renderTemplate(args),
    });
    if (result.error) {
      // eslint-disable-next-line no-console
      console.error("[email] Resend error:", result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id ?? "" };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] sendEmail threw:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
