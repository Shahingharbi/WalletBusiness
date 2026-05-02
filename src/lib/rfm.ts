/**
 * RFM Segmentation (Recency × Frequency).
 *
 * Boomerangme-style customer engagement tagging — calculé à la volée à partir
 * des `transactions` de type `stamp_add` / `reward_redeemed`. Pas de table
 * dédiée : reflète toujours l'état le plus récent.
 *
 * Segments :
 *  - new      : moins de 2 visites total
 *  - champion : >= 3 visites en 30j ET dernière visite <= 20j
 *  - loyal    : >= 3 visites total ET dernière 21-40j
 *  - at_risk  : >= 3 visites total ET dernière 41-90j
 *  - lost     : dernière visite > 90j
 *
 * Convention : une "visite" = une transaction de type `stamp_add`. On ignore
 * les autres types pour ne pas compter des installations comme des visites.
 */

export type RfmSegment =
  | "new"
  | "champion"
  | "loyal"
  | "at_risk"
  | "lost";

export interface VisitInput {
  /** ISO date string (created_at de la transaction). */
  created_at: string;
  type: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Transaction types qu'on compte comme une "visite" client. */
export function isVisitTransaction(type: string): boolean {
  return type === "stamp_add";
}

/**
 * Calcule le segment RFM d'un client à partir de la liste de ses
 * transactions (déjà filtrées sur le bon `business_id`/`client_id`).
 *
 * @param now - timestamp en millisecondes (injecté pour les tests).
 */
export function computeRfmSegmentFromVisits(
  visits: VisitInput[],
  now: number = Date.now()
): { segment: RfmSegment; visits_count: number; last_visit: string | null } {
  const filtered = visits
    .filter((v) => isVisitTransaction(v.type))
    .map((v) => ({ ts: new Date(v.created_at).getTime(), iso: v.created_at }))
    .filter((v) => Number.isFinite(v.ts))
    .sort((a, b) => b.ts - a.ts);

  const total = filtered.length;
  if (total === 0) {
    return { segment: "new", visits_count: 0, last_visit: null };
  }
  if (total < 2) {
    return { segment: "new", visits_count: total, last_visit: filtered[0].iso };
  }

  const lastTs = filtered[0].ts;
  const daysSinceLast = (now - lastTs) / DAY_MS;
  const last30dCount = filtered.filter((v) => (now - v.ts) / DAY_MS <= 30).length;

  let segment: RfmSegment;
  if (daysSinceLast > 90) {
    segment = "lost";
  } else if (total >= 3 && last30dCount >= 3 && daysSinceLast <= 20) {
    segment = "champion";
  } else if (total >= 3 && daysSinceLast > 20 && daysSinceLast <= 40) {
    segment = "loyal";
  } else if (total >= 3 && daysSinceLast > 40 && daysSinceLast <= 90) {
    segment = "at_risk";
  } else {
    // 2 visites mais pas encore "champion"/"loyal" -> reste "new" (engagement
    // pas encore avéré). Évite de classer un client de 2 scans en "champion".
    segment = total >= 3 ? "loyal" : "new";
  }

  return { segment, visits_count: total, last_visit: filtered[0].iso };
}

export const SEGMENT_LABELS: Record<RfmSegment, { label: string; emoji: string }> = {
  champion: { label: "Champions", emoji: "🏆" },
  loyal: { label: "Loyaux", emoji: "💚" },
  at_risk: { label: "À relancer", emoji: "⚠️" },
  lost: { label: "Perdus", emoji: "💤" },
  new: { label: "Nouveaux", emoji: "✨" },
};

export const SEGMENT_ORDER: RfmSegment[] = [
  "champion",
  "loyal",
  "at_risk",
  "lost",
  "new",
];
