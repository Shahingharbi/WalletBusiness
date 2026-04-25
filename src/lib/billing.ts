/**
 * Billing helpers : plans, limits, gating.
 *
 * Pure logic — safe to import from server or client (no Stripe SDK here).
 */

export type PlanId = "starter" | "pro" | "business";
export type BillingInterval = "month" | "year";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface PlanLimits {
  /** Nombre maximum de cartes (null = illimité). */
  maxCards: number | null;
  /** Nombre maximum de clients (null = illimité). */
  maxClients: number | null;
  /** Multi-employés autorisé. */
  multiEmployees: boolean;
  /** Notifications push géolocalisées. */
  geoPush: boolean;
  /** Segmentation clients. */
  segments: boolean;
  /** Cartes cadeaux digitales. */
  giftCards: boolean;
  /** API & webhooks. */
  api: boolean;
  /** Marque blanche. */
  whiteLabel: boolean;
}

export interface PlanDescriptor {
  id: PlanId;
  name: string;
  monthlyPrice: number; // EUR
  yearlyPrice: number; // EUR / mois facturé annuellement (réduit)
  description: string;
  limits: PlanLimits;
  /** Liste affichée sur la page de pricing. */
  features: readonly string[];
}

export const PLANS: Readonly<Record<PlanId, PlanDescriptor>> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyPrice: 49,
    yearlyPrice: 39,
    description:
      "Idéal pour un commerce indépendant qui démarre sa fidélisation digitale.",
    limits: {
      maxCards: 1,
      maxClients: 200,
      multiEmployees: false,
      geoPush: false,
      segments: false,
      giftCards: false,
      api: false,
      whiteLabel: false,
    },
    features: [
      "1 carte de fidélité",
      "Jusqu'à 200 clients",
      "Scanner (webapp smartphone)",
      "Notifications push gratuites",
      "Dashboard avec statistiques",
      "QR code à imprimer",
      "Support par email",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPrice: 99,
    yearlyPrice: 79,
    description:
      "Pour les commerçants qui veulent aller plus loin avec la géolocalisation et la segmentation.",
    limits: {
      maxCards: 5,
      maxClients: 2000,
      multiEmployees: false,
      geoPush: true,
      segments: true,
      giftCards: true,
      api: false,
      whiteLabel: false,
    },
    features: [
      "Jusqu'à 5 cartes de fidélité",
      "Jusqu'à 2 000 clients",
      "Tout le plan Starter +",
      "Statistiques avancées",
      "Notifications géolocalisées",
      "Segmentation clients",
      "Cartes cadeaux digitales",
      "Support prioritaire par chat",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    monthlyPrice: 199,
    yearlyPrice: 159,
    description:
      "Pour les réseaux et franchises qui ont besoin de puissance et de personnalisation.",
    limits: {
      maxCards: null,
      maxClients: null,
      multiEmployees: true,
      geoPush: true,
      segments: true,
      giftCards: true,
      api: true,
      whiteLabel: true,
    },
    features: [
      "Cartes illimitées",
      "Clients illimités",
      "Multi-employés",
      "Tout le plan Pro +",
      "API & webhooks",
      "Intégrations caisse (sur demande)",
      "Support prioritaire téléphone",
      "Marque blanche",
      "Account manager dédié",
    ],
  },
};

export const PLAN_ORDER: readonly PlanId[] = ["starter", "pro", "business"];

export function getPlanLimits(plan: PlanId | null | undefined): PlanLimits {
  if (!plan) return PLANS.starter.limits;
  return PLANS[plan].limits;
}

export function getPlanDescriptor(plan: PlanId): PlanDescriptor {
  return PLANS[plan];
}

/**
 * Statuses qui débloquent l'accès aux fonctionnalités payantes.
 * `trialing` est inclus : pendant l'essai, l'utilisateur a accès à tout
 * (par défaut on considère le plan Pro pendant le trial).
 */
export function isSubscriptionActive(
  status: SubscriptionStatus | string | null | undefined
): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Représentation minimale d'un business pour les checks billing côté server.
 */
export interface BusinessBillingState {
  subscription_status: SubscriptionStatus | string | null;
  subscription_plan: PlanId | string | null;
  trial_ends_at: string | null;
}

/**
 * `true` si le commerce est encore dans sa fenêtre d'essai et n'a pas
 * d'abonnement actif.
 */
export function isInTrial(b: BusinessBillingState, now: Date = new Date()): boolean {
  if (isSubscriptionActive(b.subscription_status)) return false;
  if (!b.trial_ends_at) return false;
  return new Date(b.trial_ends_at).getTime() > now.getTime();
}

/**
 * Nombre de jours restants avant la fin de l'essai (peut être négatif).
 */
export function trialDaysRemaining(
  b: BusinessBillingState,
  now: Date = new Date()
): number | null {
  if (!b.trial_ends_at) return null;
  const diffMs = new Date(b.trial_ends_at).getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * `true` si l'essai est écoulé et qu'aucun abonnement actif ne couvre le
 * commerce. Bloque l'accès aux features création/écriture.
 */
export function isLockedOut(
  b: BusinessBillingState,
  now: Date = new Date()
): boolean {
  if (isSubscriptionActive(b.subscription_status)) return false;
  return !isInTrial(b, now);
}

/**
 * Plan effectif. Pendant l'essai (sans abonnement) on accorde l'équivalent
 * du plan `pro` afin que le merchant puisse tester la totalité de l'app.
 */
export function effectivePlan(b: BusinessBillingState): PlanId {
  if (isSubscriptionActive(b.subscription_status)) {
    const p = b.subscription_plan;
    if (p === "starter" || p === "pro" || p === "business") return p;
    return "starter";
  }
  if (isInTrial(b)) return "pro";
  return "starter";
}

export type GatedFeature =
  | "extra_cards"
  | "extra_clients"
  | "multi_employees"
  | "geo_push"
  | "segments"
  | "gift_cards"
  | "api"
  | "white_label";

export interface RequirePlanOk {
  ok: true;
  plan: PlanId;
}

export interface RequirePlanFail {
  ok: false;
  reason: "trial_expired" | "plan_too_low";
  /** Plan minimum requis pour débloquer la feature. */
  requiredPlan: PlanId;
  message: string;
}

export type RequirePlanResult = RequirePlanOk | RequirePlanFail;

/**
 * Server-side guard : vérifie que le business a accès à `feature`.
 *
 * Ne fait PAS de query DB — passe l'état du business (déjà chargé) en arg.
 */
export function requirePlan(
  business: BusinessBillingState,
  feature: GatedFeature,
  context?: { currentCardsCount?: number; currentClientsCount?: number }
): RequirePlanResult {
  if (isLockedOut(business)) {
    return {
      ok: false,
      reason: "trial_expired",
      requiredPlan: "starter",
      message:
        "Votre essai gratuit a expiré. Choisissez un plan pour continuer à utiliser aswallet.",
    };
  }

  const plan = effectivePlan(business);
  const limits = getPlanLimits(plan);

  switch (feature) {
    case "extra_cards": {
      const cards = context?.currentCardsCount ?? 0;
      if (limits.maxCards === null || cards < limits.maxCards) {
        return { ok: true, plan };
      }
      const required: PlanId = plan === "starter" ? "pro" : "business";
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: required,
        message: `Vous avez atteint la limite de ${limits.maxCards} carte${
          limits.maxCards > 1 ? "s" : ""
        } du plan ${PLANS[plan].name}. Passez au plan ${
          PLANS[required].name
        } pour en créer plus.`,
      };
    }
    case "extra_clients": {
      const clients = context?.currentClientsCount ?? 0;
      if (limits.maxClients === null || clients < limits.maxClients) {
        return { ok: true, plan };
      }
      const required: PlanId = plan === "starter" ? "pro" : "business";
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: required,
        message: `Vous avez atteint la limite de ${limits.maxClients} clients du plan ${PLANS[plan].name}. Passez au plan ${PLANS[required].name}.`,
      };
    }
    case "multi_employees":
      if (limits.multiEmployees) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "business",
        message:
          "Le multi-employés est inclus dans le plan Business. Passez au plan Business pour inviter plusieurs collaborateurs.",
      };
    case "geo_push":
      if (limits.geoPush) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "pro",
        message:
          "Les notifications géolocalisées sont incluses à partir du plan Pro.",
      };
    case "segments":
      if (limits.segments) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "pro",
        message:
          "La segmentation clients est incluse à partir du plan Pro.",
      };
    case "gift_cards":
      if (limits.giftCards) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "pro",
        message:
          "Les cartes cadeaux digitales sont incluses à partir du plan Pro.",
      };
    case "api":
      if (limits.api) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "business",
        message:
          "L'API et les webhooks sont inclus dans le plan Business.",
      };
    case "white_label":
      if (limits.whiteLabel) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "business",
        message: "La marque blanche est incluse dans le plan Business.",
      };
  }
}

/**
 * Récupère l'env Stripe Price ID pour un (plan, interval). Server-only.
 */
export function getPriceId(
  plan: PlanId,
  interval: BillingInterval
): string {
  const key = `STRIPE_PRICE_ID_${plan.toUpperCase()}_${
    interval === "month" ? "MONTH" : "YEAR"
  }`;
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[billing] Env var ${key} non configurée. Voir docs/TODO-manual.md section 3.`
    );
  }
  return value;
}

/**
 * Inverse de getPriceId : retrouve (plan, interval) à partir d'un Price ID.
 * Utilisé dans le webhook quand Stripe nous renvoie un price.
 */
export function lookupPriceId(
  priceId: string
): { plan: PlanId; interval: BillingInterval } | null {
  const candidates: Array<[PlanId, BillingInterval, string | undefined]> = [
    ["starter", "month", process.env.STRIPE_PRICE_ID_STARTER_MONTH],
    ["starter", "year", process.env.STRIPE_PRICE_ID_STARTER_YEAR],
    ["pro", "month", process.env.STRIPE_PRICE_ID_PRO_MONTH],
    ["pro", "year", process.env.STRIPE_PRICE_ID_PRO_YEAR],
    ["business", "month", process.env.STRIPE_PRICE_ID_BUSINESS_MONTH],
    ["business", "year", process.env.STRIPE_PRICE_ID_BUSINESS_YEAR],
  ];
  for (const [plan, interval, env] of candidates) {
    if (env && env === priceId) return { plan, interval };
  }
  return null;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "business";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}
