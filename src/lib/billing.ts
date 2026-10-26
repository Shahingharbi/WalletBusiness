/**
 * Billing helpers : plans, limits, gating.
 *
 * Pure logic — safe to import from server or client (no Stripe SDK here).
 */

export type PlanId = "starter" | "pro" | "business" | "enterprise";
/**
 * Stripe SDK exposes the canonical interval as `month | year`. We accept the
 * UI alias `monthly | annual` (used in the public pricing page query string)
 * via {@link normalizeBillingInterval} so the two never get mixed up.
 */
export type BillingInterval = "month" | "year";
export type BillingIntervalAlias = "monthly" | "annual";

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
  /** Nombre maximum d'employés / vendeurs (null = illimité). */
  maxEmployees: number | null;
  /** Nombre maximum de localisations geo-push (0 = pas de geo-push). */
  maxGeoLocations: number;
  /** Multi-employés autorisé (= maxEmployees > 1 ou null). */
  multiEmployees: boolean;
  /** Notifications push géolocalisées. */
  geoPush: boolean;
  /** Segmentation RFM auto. */
  segments: boolean;
  /** Auto-push événementiels (anniversaire, relance, etc.). */
  autoPush: boolean;
  /** Cartes cadeaux digitales. */
  giftCards: boolean;
  /** Multi-boutiques (plusieurs établissements). */
  multiShop: boolean;
  /** API & webhooks. */
  api: boolean;
  /** Marque blanche. */
  whiteLabel: boolean;
  /** Push campaigns aux porteurs de carte (broadcasts). */
  campaigns: boolean;
}

export interface PlanDescriptor {
  id: PlanId;
  name: string;
  /** Mensuel facturé au mois — null = "Sur devis". */
  monthlyPrice: number | null;
  /** Mensuel facturé annuellement (réduit) — null = "Sur devis". */
  yearlyPrice: number | null;
  /** Total annuel quand facturé annuellement — null = "Sur devis". */
  yearlyTotal: number | null;
  /** Description courte affichée sous le titre. */
  description: string;
  /** Public cible affiché en mini-tagline. */
  audience: string;
  limits: PlanLimits;
  /** Liste affichée sur la page de pricing. */
  features: readonly string[];
}

export const PLANS: Readonly<Record<PlanId, PlanDescriptor>> = {
  starter: {
    id: "starter",
    name: "Essentiel",
    monthlyPrice: 99,
    yearlyPrice: 79,
    yearlyTotal: 948,
    description:
      "Tout pour lancer votre carte de fidélité et faire revenir vos clients.",
    audience: "1 boutique — kebab, boulangerie, café, salon, snack…",
    limits: {
      maxCards: 1,
      maxClients: null,
      maxEmployees: 3,
      maxGeoLocations: 1,
      multiEmployees: true,
      geoPush: true,
      segments: false,
      autoPush: false,
      giftCards: false,
      multiShop: false,
      api: false,
      whiteLabel: false,
      campaigns: true,
    },
    features: [
      "Installation sur place par un conseiller",
      "Design de la carte à vos couleurs, fait pour vous",
      "Carte de fidélité Apple Wallet & Google Wallet",
      "Clients illimités",
      "Notifications push illimitées : promos, nouveautés, événements",
      "Demande d'avis Google automatique après le passage",
      "Notification quand un client passe près de la boutique",
      "Affiche QR code prête à imprimer",
      "Scanner pour 3 employés",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPrice: 149,
    yearlyPrice: 119,
    yearlyTotal: 1428,
    description:
      "Le pilote automatique : vos clients sont relancés au bon moment, sans effort.",
    audience: "1 boutique qui veut voir ses clients revenir plus souvent",
    limits: {
      maxCards: 3,
      maxClients: null,
      maxEmployees: 10,
      maxGeoLocations: 1,
      multiEmployees: true,
      geoPush: true,
      segments: true,
      autoPush: true,
      giftCards: true,
      multiShop: false,
      api: false,
      whiteLabel: false,
      campaigns: true,
    },
    features: [
      "Tout Essentiel +",
      "Relance automatique des clients absents depuis 30 jours",
      "Message « Plus que X tampons » avant la récompense",
      "Message d'anniversaire automatique",
      "Segmentation clients : fidèles, à relancer, perdus",
      "Jusqu'à 3 cartes (ex. carte tampons + carte VIP)",
      "Scanner pour 10 employés",
      "Support prioritaire sur WhatsApp",
    ],
  },
  business: {
    id: "business",
    name: "Multi-boutiques",
    monthlyPrice: 299,
    yearlyPrice: 239,
    yearlyTotal: 2868,
    description:
      "Une seule carte pour toutes vos boutiques : le client cumule ses tampons partout.",
    audience: "2 à 5 boutiques — chaînes et petites franchises",
    limits: {
      maxCards: null,
      maxClients: null,
      maxEmployees: null,
      maxGeoLocations: 5,
      multiEmployees: true,
      geoPush: true,
      segments: true,
      autoPush: true,
      giftCards: true,
      multiShop: true,
      api: true,
      whiteLabel: false,
      campaigns: true,
    },
    features: [
      "Tout Pro +",
      "Jusqu'à 5 boutiques avec une carte commune",
      "Notification de proximité devant chaque boutique",
      "Cartes et employés illimités",
      "Un seul tableau de bord pour toutes vos boutiques",
      "Formation de vos équipes sur place",
      "Conseiller dédié",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Réseau",
    monthlyPrice: null,
    yearlyPrice: null,
    yearlyTotal: null,
    description: "Pour les franchises et enseignes de plus de 5 boutiques.",
    audience: "Plus de 5 boutiques — franchises, enseignes",
    limits: {
      maxCards: null,
      maxClients: null,
      maxEmployees: null,
      maxGeoLocations: Number.POSITIVE_INFINITY,
      multiEmployees: true,
      geoPush: true,
      segments: true,
      autoPush: true,
      giftCards: true,
      multiShop: true,
      api: true,
      whiteLabel: true,
      campaigns: true,
    },
    features: [
      "Tout Multi-boutiques +",
      "Boutiques illimitées",
      "Déploiement accompagné dans tout le réseau",
      "Tarif adapté à la taille du réseau",
    ],
  },
};

/**
 * Ordre canonique pour l'affichage des plans : du moins cher au plus cher,
 * Enterprise en dernier (sur devis).
 */
export const PLAN_ORDER: readonly PlanId[] = [
  "starter",
  "pro",
  "business",
  "enterprise",
];

/**
 * Plans disponibles à la souscription Stripe (Enterprise = manuel/sales).
 */
export const STRIPE_PLANS: readonly Exclude<PlanId, "enterprise">[] = [
  "starter",
  "pro",
  "business",
];

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
    if (p === "starter" || p === "pro" || p === "business" || p === "enterprise") {
      return p;
    }
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
  | "auto_push"
  | "multi_shop"
  | "api"
  | "white_label"
  | "campaigns";

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
        requiredPlan: "pro",
        message:
          "Le multi-employés est inclus à partir du plan Pro. Passez au plan Pro pour inviter jusqu'à 5 vendeurs.",
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
          "La segmentation RFM auto est incluse à partir du plan Pro.",
      };
    case "gift_cards":
      if (limits.giftCards) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "pro",
        message:
          "Les cartes cadeaux digitales sont incluses à partir de l'offre Pro.",
      };
    case "auto_push":
      if (limits.autoPush) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "pro",
        message:
          "Les relances automatiques sont incluses à partir de l'offre Pro.",
      };
    case "multi_shop":
      if (limits.multiShop) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "business",
        message: "Le multi-boutiques est inclus dans l'offre Multi-boutiques.",
      };
    case "api":
      if (limits.api) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "business",
        message:
          "L'API et les webhooks sont inclus dans l'offre Multi-boutiques.",
      };
    case "white_label":
      if (limits.whiteLabel) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "enterprise",
        message: "La marque blanche est incluse dans l'offre Réseau.",
      };
    case "campaigns":
      if (limits.campaigns) return { ok: true, plan };
      return {
        ok: false,
        reason: "plan_too_low",
        requiredPlan: "pro",
        message:
          "Les campagnes push wallet sont incluses dans toutes les offres.",
      };
  }
}

/**
 * Convertit un alias UI ("monthly" | "annual") en {@link BillingInterval}
 * canonique ("month" | "year"). Inconnu => "month" par défaut sécurisant.
 */
export function normalizeBillingInterval(
  value: BillingInterval | BillingIntervalAlias | string | null | undefined
): BillingInterval {
  if (value === "year" || value === "annual") return "year";
  return "month";
}

/**
 * Inverse de {@link normalizeBillingInterval} : alias UI utilisé dans les
 * URLs (`?interval=annual`).
 */
export function toBillingIntervalAlias(
  interval: BillingInterval
): BillingIntervalAlias {
  return interval === "year" ? "annual" : "monthly";
}

/**
 * Récupère l'env Stripe Price ID pour un (plan, interval). Server-only.
 *
 * Tolère deux conventions de nommage pour rester rétro-compatible :
 *  - Nouvelle (recommandée) : `STRIPE_PRICE_ID_PRO_MONTHLY` / `_ANNUAL`
 *  - Ancienne                : `STRIPE_PRICE_ID_PRO_MONTH` / `_YEAR`
 *
 * Enterprise n'a pas de price ID — c'est une vente assistée.
 */
export function getPriceId(
  plan: PlanId,
  interval: BillingInterval | BillingIntervalAlias
): string {
  if (plan === "enterprise") {
    throw new Error(
      "[billing] Enterprise n'a pas de price Stripe — flow de vente assistée."
    );
  }
  const normalized = normalizeBillingInterval(interval);
  const upperPlan = plan.toUpperCase();
  const newKey = `STRIPE_PRICE_ID_${upperPlan}_${
    normalized === "month" ? "MONTHLY" : "ANNUAL"
  }`;
  const legacyKey = `STRIPE_PRICE_ID_${upperPlan}_${
    normalized === "month" ? "MONTH" : "YEAR"
  }`;
  const value =
    (process.env[newKey] && process.env[newKey]?.trim()) ||
    (process.env[legacyKey] && process.env[legacyKey]?.trim());
  if (!value) {
    throw new Error(
      `[billing] Env var ${newKey} (ou ${legacyKey}) non configurée. Voir docs/TODO-manual.md section 3.`
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
): { plan: Exclude<PlanId, "enterprise">; interval: BillingInterval } | null {
  const candidates: Array<[
    Exclude<PlanId, "enterprise">,
    BillingInterval,
    Array<string | undefined>,
  ]> = [
    [
      "starter",
      "month",
      [
        process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
        process.env.STRIPE_PRICE_ID_STARTER_MONTH,
      ],
    ],
    [
      "starter",
      "year",
      [
        process.env.STRIPE_PRICE_ID_STARTER_ANNUAL,
        process.env.STRIPE_PRICE_ID_STARTER_YEAR,
      ],
    ],
    [
      "pro",
      "month",
      [
        process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
        process.env.STRIPE_PRICE_ID_PRO_MONTH,
      ],
    ],
    [
      "pro",
      "year",
      [
        process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
        process.env.STRIPE_PRICE_ID_PRO_YEAR,
      ],
    ],
    [
      "business",
      "month",
      [
        process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
        process.env.STRIPE_PRICE_ID_BUSINESS_MONTH,
      ],
    ],
    [
      "business",
      "year",
      [
        process.env.STRIPE_PRICE_ID_BUSINESS_ANNUAL,
        process.env.STRIPE_PRICE_ID_BUSINESS_YEAR,
      ],
    ],
  ];
  for (const [plan, interval, envValues] of candidates) {
    for (const env of envValues) {
      if (env && env === priceId) return { plan, interval };
    }
  }
  return null;
}

export function isPlanId(value: unknown): value is PlanId {
  return (
    value === "starter" ||
    value === "pro" ||
    value === "business" ||
    value === "enterprise"
  );
}

/**
 * Restreint à un plan souscriptible Stripe (exclut Enterprise).
 */
export function isStripePlanId(
  value: unknown
): value is Exclude<PlanId, "enterprise"> {
  return value === "starter" || value === "pro" || value === "business";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}

/**
 * Accepte aussi les alias UI "monthly" | "annual" en plus de "month" | "year".
 */
export function isBillingIntervalLike(
  value: unknown
): value is BillingInterval | BillingIntervalAlias {
  return (
    value === "month" ||
    value === "year" ||
    value === "monthly" ||
    value === "annual"
  );
}
