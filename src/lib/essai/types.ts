/**
 * « Votre carte en 30 secondes » — contrat partagé entre :
 *  - l'extraction de marque        (lib/essai/brand/*)
 *  - la création / démo de carte   (lib/essai/create.ts, actions.ts)
 *  - les routes                    (/api/essai/*)
 *  - les pages                     (/essai, /essai/[token], /essai/[token]/garder)
 *
 * Une « carte d'essai » = une vraie carte (table `cards`) rattachée au
 * commerce interne `aswallet-essai`, avec UNE carte client (`card_instances`)
 * installable tout de suite dans Apple / Google Wallet via les routes
 * existantes /api/apple-wallet/[token] et /api/google-wallet/[token].
 */

import type { StampIconKey } from "@/lib/stamp-icons";

/** Slug du commerce interne qui porte toutes les cartes d'essai. */
export const ESSAI_BUSINESS_SLUG = "aswallet-essai";

export const ESSAI_CATEGORIES = [
  "kebab",
  "burger",
  "tacos",
  "chicken",
  "pizza",
  "sushi",
  "restaurant",
  "boulangerie",
  "patisserie",
  "cafe",
  "bar",
  "glacier",
  "coiffeur",
  "barbier",
  "beaute",
  "onglerie",
  "fleuriste",
  "epicerie",
  "boucherie",
  "pressing",
  "autre",
] as const;
export type EssaiCategory = (typeof ESSAI_CATEGORIES)[number];

export type EssaiSource = "website" | "maps" | "instagram" | "photo" | "name";

export type StampShape = "circle" | "squircle" | "shield" | "star" | "hex";

export interface BrandColors {
  /** Fond de la carte (#rrggbb). */
  background: string;
  /** Texte principal (#rrggbb) — toujours lisible sur `background`. */
  text: string;
  /** Accent : tampons remplis, highlights (#rrggbb). */
  accent: string;
}

export interface BrandLogo {
  /** PNG carré 512×512 prêt à uploader (coins transparents autorisés). */
  png: Buffer;
  width: number;
  height: number;
  /** Logo réel du commerce, ou logo typographique généré (initiales). */
  kind: "real" | "typographic";
}

/** Préréglages de carte par métier (lib/essai/brand/category.ts). */
export interface CategoryPreset {
  label: string;
  stampIcon: StampIconKey;
  stampShape: StampShape;
  stampCount: number;
  /** ≤ 60 caractères. */
  rewardText: string;
  /** ≤ 14 caractères. */
  labelStamps: string;
}

/** Résultat complet de l'analyse d'un commerce. */
export interface BrandProfile {
  source: EssaiSource;
  sourceUrl: string | null;
  /** Nom affiché sur la carte (≤ 40 car.). */
  name: string;
  category: EssaiCategory;
  colors: BrandColors;
  /** Palette mesurée sur les pixels (hex), la plus représentative d'abord. */
  palette: string[];
  logo: BrandLogo;
  rewardText: string;
  stampCount: number;
  stampIcon: StampIconKey;
  stampShape: StampShape;
  labelStamps: string;
  /** Texte de la notification « promo » de démo (≤ 120 car.). */
  promoMessage: string;
  /** Lien vers le formulaire d'avis Google, si trouvé. */
  reviewUrl: string | null;
  address: string | null;
  location: { lat: number; lng: number } | null;
  website: string | null;
  aiUsed: boolean;
  /** Messages affichables à l'utilisateur (français, courts). */
  warnings: string[];
}

export interface BrandInput {
  url?: string | null;
  image?: { buffer: Buffer; mimeType: string } | null;
  /** Nom saisi par l'utilisateur — prioritaire sur le nom détecté. */
  name?: string | null;
}

// ─── Signaux intermédiaires (partagés entre les modules brand/*) ──────────

export interface LogoCandidate {
  /** URL absolue de l'image (png/jpg/webp/svg/gif) OU svg inline. */
  url?: string;
  svg?: string;
  /** Origine, par ordre de confiance décroissant côté appelant. */
  kind:
    | "jsonld"
    | "img-logo"
    | "inline-svg"
    | "apple-touch-icon"
    | "manifest-icon"
    | "icon"
    | "og-image"
    | "favicon"
    | "places-photo";
  /** Taille déclarée (px) si connue. */
  size?: number;
}

export interface WebsiteSignals {
  finalUrl: string;
  /** Nom le plus probable (déjà nettoyé : « Accueil | X » → « X »). */
  name: string | null;
  description: string | null;
  themeColor: string | null;
  manifestColors: string[];
  logoCandidates: LogoCandidate[];
  /** Types schema.org trouvés dans le JSON-LD (ex. "Restaurant", "Bakery"). */
  jsonLdTypes: string[];
  address: string | null;
  location: { lat: number; lng: number } | null;
  /** ~2 000 premiers caractères de texte visible (pour détecter le métier). */
  textSample: string;
}

export interface MapsSignals {
  name: string | null;
  location: { lat: number; lng: number } | null;
  address: string | null;
  /** Types Google (ex. "restaurant", "bakery") si Places API dispo. */
  types: string[];
  website: string | null;
  /** Lien d'avis : writereview?placeid=… si Places API, sinon lien de la fiche. */
  reviewUrl: string | null;
  /** Lien canonique de la fiche Google Maps. */
  mapsUrl: string | null;
  placesApiUsed: boolean;
}

export interface PaletteColor {
  hex: string;
  /** Part des pixels opaques (0..1). */
  ratio: number;
  /** HSL 0..1. */
  saturation: number;
  lightness: number;
}

export interface AiBrandResult {
  businessName: string | null;
  category: EssaiCategory;
  /** Couleurs de marque choisies DANS la palette mesurée fournie (hex). */
  primaryColor: string | null;
  secondaryColor: string | null;
  rewardText: string | null;
  promoMessage: string | null;
  /** L'image fournie est-elle elle-même un logo (fichier logo) ? */
  imageIsLogo: boolean;
  /** Zone du logo / photo de profil dans l'image, coordonnées 0..1. */
  logoBox: { x: number; y: number; w: number; h: number } | null;
}

// ─── Métadonnées stockées dans cards.design.essai ─────────────────────────

export interface EssaiMeta {
  v: 1;
  source: EssaiSource;
  source_url: string | null;
  category: EssaiCategory;
  palette: string[];
  logo_kind: "real" | "typographic";
  review_url: string | null;
  promo_message: string;
  address: string | null;
  location: { lat: number; lng: number } | null;
  website: string | null;
  ai_used: boolean;
  warnings: string[];
  created_at: string;
  actions: { stamp: number; promo: number; review: number };
  claimed: { business_id: string; card_id: string; at: string } | null;
}

// ─── Contrat HTTP ─────────────────────────────────────────────────────────

/** POST /api/essai (multipart/form-data : url?, name?, image?) → 200 */
export interface EssaiCreateResponse {
  token: string;
  cardId: string;
  name: string;
  category: EssaiCategory;
  colors: BrandColors;
  logoUrl: string;
  logoKind: "real" | "typographic";
  source: EssaiSource;
  aiUsed: boolean;
  warnings: string[];
}

/** GET /api/essai/[token] → 200 (résumé public, utilisé par /register) */
export interface EssaiSummaryResponse {
  token: string;
  cardId: string;
  name: string;
  logoUrl: string | null;
  colors: BrandColors;
  rewardText: string;
  claimed: boolean;
}

export type EssaiActionType = "stamp" | "promo" | "review";

/** POST /api/essai/[token]/action { type } → 200 */
export interface EssaiActionResponse {
  ok: true;
  type: EssaiActionType;
  stamps: number;
  stampCount: number;
  rewards: number;
  /** Texte de la notification envoyée (promo / review). */
  message: string | null;
}

/** POST /api/essai/[token]/claim (connecté) → 200 */
export interface EssaiClaimResponse {
  ok: true;
  cardId: string;
  alreadyClaimed: boolean;
}

/** Toutes les erreurs : { error } en français, status HTTP adapté. */
export interface EssaiErrorResponse {
  error: string;
}
