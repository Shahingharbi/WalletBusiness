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

/**
 * Type de carte choisi par le commerçant (valeurs = `cards.card_type`) :
 * Tampons / Points / Remise permanente / Carte VIP.
 */
export const ESSAI_CARD_TYPES = ["stamp", "cashback", "discount", "membership"] as const;
export type EssaiCardType = (typeof ESSAI_CARD_TYPES)[number];
export const ESSAI_CARD_TYPE_LABELS: Record<EssaiCardType, string> = {
  stamp: "Tampons",
  cashback: "Points",
  discount: "Remise",
  membership: "Carte VIP",
};

/**
 * Suggestions douces affichées dans l'interface (jamais de message
 * d'erreur technique) : « Ajoutez votre logo », « Ajoutez une photo »…
 */
export type EssaiSuggestion = "add_logo" | "add_photo" | "add_screenshot";

/** Photo de fond de la bande de tampons — OBLIGATOIRE sur toute carte. */
export interface BrandPhoto {
  /** JPEG paysage prêt à uploader (≈ 1 600 px de large). */
  jpeg: Buffer;
  width: number;
  height: number;
  source: "upload" | "screenshot" | "website" | "places" | "instagram" | "stock";
}

/** Image envoyée par l'utilisateur (déjà compressée côté navigateur). */
export interface UploadedImage {
  buffer: Buffer;
  mimeType: string;
}

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
  /** Type de carte (défaut "stamp"). L'offre est écrite pour ce type. */
  cardType: EssaiCardType;
  /** Photo de la bande (toujours présente : au pire photo du métier). */
  photo: BrandPhoto;
  /** Prénom affiché « Bonjour <prénom> » sur la carte de démo. */
  firstName: string | null;
  /** Suggestions douces pour l'interface (pas de message d'erreur). */
  suggestions: EssaiSuggestion[];
  /** Fiche Google liée (avis) : « Nom — adresse », pour l'afficher au commerçant. */
  reviewLabel?: string | null;
}

export interface BrandInput {
  url?: string | null;
  /** Ancien champ unique : traité comme une capture / photo « auto ». */
  image?: UploadedImage | null;
  /** Logo déposé par l'utilisateur (prioritaire sur tout logo détecté). */
  logoImage?: UploadedImage | null;
  /** Photo de devanture / de l'intérieur (prioritaire pour la bande). */
  photoImage?: UploadedImage | null;
  /** Capture d'écran d'un profil Instagram / Facebook. */
  screenshotImage?: UploadedImage | null;
  /** Nom saisi par l'utilisateur — prioritaire sur le nom détecté. */
  name?: string | null;
  firstName?: string | null;
  cardType?: EssaiCardType | null;
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
  /**
   * Photos candidates pour la bande (URLs absolues, meilleure d'abord) :
   * og:image / twitter:image paysage, image JSON-LD, grandes images du haut de page.
   */
  photoCandidates?: string[];
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
  /** Identifiant Places (ChIJ…) si connu. */
  placeId?: string | null;
  /** Photos Places API (New) : noms de ressource « places/…/photos/… », meilleure d'abord. */
  photoNames?: string[];
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
  /** Zone d'une belle photo exploitable pour la bande (devanture, plat), 0..1. */
  photoBox?: { x: number; y: number; w: number; h: number } | null;
  /** Enseigne connue (ex. McDonald's) : couleurs officielles fiables. */
  knownBrand?: boolean;
  /** Site web affiché dans la bio / le profil (capture Instagram, Facebook). */
  website?: string | null;
  /** Ville visible (bio, enseigne, adresse) — aide à trouver la bonne fiche Google. */
  city?: string | null;
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
  suggestions: EssaiSuggestion[];
  card_type: EssaiCardType;
  photo_source: BrandPhoto["source"];
  first_name: string | null;
  /** Incrémenté à chaque retouche : sert à casser le cache des images (bannière). */
  design_version: number;
  /** Fiche Google liée aux avis : « Nom — adresse » (affichage). */
  review_label?: string | null;
  created_at: string;
  actions: { stamp: number; promo: number; review: number };
  claimed: { business_id: string; card_id: string; at: string } | null;
  /**
   * SHA-256 (hex) de la clé d'édition remise au créateur dans le cookie
   * httpOnly `essai_k_<token>`. Seul ce navigateur peut retoucher la carte.
   * Absent sur les cartes v1 plus anciennes (édition libre, compatibilité).
   * Ne JAMAIS l'exposer (EssaiCardView, réponses HTTP).
   */
  edit_key_hash?: string;
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
  cardType: EssaiCardType;
  photoUrl: string;
  suggestions: EssaiSuggestion[];
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

/**
 * Vue complète d'une carte d'essai pour l'aperçu « réplique Wallet » et les
 * retouches en direct. Renvoyée par GET /api/essai/[token]?view=full,
 * PATCH /api/essai/[token] et POST /api/essai/[token]/media.
 */
export interface EssaiCardView extends EssaiSummaryResponse {
  category: EssaiCategory;
  cardType: EssaiCardType;
  logoKind: "real" | "typographic";
  photoUrl: string | null;
  stamps: number;
  stampCount: number;
  rewards: number;
  labelStamps: string;
  stampIcon: string;
  stampShape: StampShape;
  firstName: string | null;
  /** URL de la VRAIE bande (/api/wallet/banner/…), versionnée (cache-bust). */
  bannerUrl: string;
  designVersion: number;
  suggestions: EssaiSuggestion[];
  expired: boolean;
  expiresAt: string;
  /** Fiche Google utilisée pour la demande d'avis (url null = aucune trouvée). */
  review?: { url: string | null; label: string | null };
}

/** PATCH /api/essai/[token] (JSON) → EssaiCardView. Tous les champs facultatifs. */
export interface EssaiUpdateRequest {
  cardType?: EssaiCardType;
  /** null = réécrire automatiquement l'offre pour le métier + type. */
  rewardText?: string | null;
  firstName?: string | null;
  name?: string;
  colors?: Partial<BrandColors>;
  /** Lien Google Maps de la fiche du commerce → vrai lien d'avis (writereview). */
  googleMapsUrl?: string | null;
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
