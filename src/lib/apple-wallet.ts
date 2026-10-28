import { PKPass, type Field } from "passkit-generator";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { shortLabel } from "./wallet-colors";

/**
 * Localisation embarquée dans un pass Apple/Google.
 * Apple en accepte jusqu'à 10 par pass — au-delà, iOS ignore les suivantes.
 */
export interface PassLocation {
  latitude: number;
  longitude: number;
  /** Texte affiché en notif lockscreen (Apple) / sur la carte (Google). */
  relevantText?: string | null;
}

/**
 * Type de carte stocké en DB. Détermine si on rend un compteur (stamp/cashback)
 * ou juste l'offre en grand (discount/membership).
 */
export type CardKind =
  | "stamp"
  | "cashback"
  | "discount"
  | "membership";

/** `cards.card_type` (texte libre en DB) → type rendu par les wallets. */
export function normalizeCardKind(value: unknown): CardKind {
  return value === "cashback" || value === "discount" || value === "membership"
    ? value
    : "stamp";
}

/** Types avec compteur « X / Y » (les autres : avantage permanent, pas de grille). */
export function isCounterKind(kind: CardKind): boolean {
  return kind === "stamp" || kind === "cashback";
}

/**
 * Version de la bande (strip Apple / heroImage Google) d'une carte, ajoutée
 * en `?v=` à l'URL de /api/wallet/banner : quand le design change (photo,
 * couleurs, tampons), l'URL change et Apple / Google / les CDN ne peuvent
 * plus servir l'ancienne image.
 *
 *  - carte d'essai : `design.essai.design_version` (incrémenté à chaque retouche) ;
 *  - autre carte   : empreinte courte des champs du design qui changent l'image.
 */
export function bannerVersionOf(design: Record<string, unknown> | null | undefined): string {
  const d = design ?? {};
  const essai = d.essai as { design_version?: unknown } | null | undefined;
  const v = Number(essai?.design_version);
  if (Number.isFinite(v) && v > 0) return String(Math.floor(v));
  const material = [
    d.banner_url,
    d.background_color,
    d.accent_color,
    d.stamp_icon,
    d.stamp_shape,
    d.stamp_active_url,
    d.stamp_inactive_url,
  ]
    .map((x) => (typeof x === "string" ? x : ""))
    .join("|");
  return crypto.createHash("sha1").update(material).digest("hex").slice(0, 8);
}

/**
 * Chemin (relatif) de la bande dynamique photo + tampons d'une carte client.
 * Même image pour Apple (strip), Google (heroImage) et l'aperçu du site.
 */
export function walletBannerPath(
  token: string,
  stamps: number,
  kind: CardKind,
  version?: string | number | null,
): string {
  const count = Math.max(0, Math.floor(Number(stamps) || 0));
  const v = version === null || version === undefined || version === "" ? "" : `&v=${encodeURIComponent(String(version))}`;
  return `/api/wallet/banner/${encodeURIComponent(token)}/${count}?kind=${kind}${v}`;
}

interface ApplePassParams {
  cardId: string;
  cardName: string;
  businessName: string;
  /**
   * Type de carte. Quand absent ou inconnu, traité comme "stamp" (rétro-compat).
   * - stamp / cashback : strip image + headerField "X / Y"
   * - discount / membership : pas de compteur, l'offre prend toute la place
   */
  cardKind?: CardKind | null;
  /**
   * Override optionnel du nom affiché en logoText (top-left du pass Apple).
   * Si fourni et non vide, remplace `businessName` pour le branding du wallet.
   */
  walletBusinessName?: string | null;
  customerInstanceToken: string;
  customerFirstName?: string | null;
  stampsCollected: number;
  stampsTotal: number;
  rewardsAvailable: number;
  rewardText: string;
  /** Couleur de FOND du pass (la couleur dominante derrière tout le contenu). */
  backgroundColor: string;
  /** Couleur du TEXTE principal (valeurs des fields). */
  textColor?: string;
  /** Couleur d'accent (texte secondaire, icônes des tampons remplis). */
  accentColor?: string;
  appUrl: string;
  /** Merchant's logo (carré idéalement) — affiché top-left du pass Apple. */
  logoUrl?: string | null;
  /**
   * Label custom au-dessus du compteur (gauche du strip). Par défaut "Tampons"
   * mais le merchant peut choisir "Visites", "Achats", "Cafés" etc. dans le
   * designer.
   */
  stampsLabel?: string | null;
  /**
   * Points de vente du commerce. Apple PassKit affiche une notif sur l'écran
   * verrouillé quand le porteur passe dans un rayon de ~100m. Max 10.
   */
  locations?: PassLocation[];
  /**
   * Dernier message de campagne envoyé à ce client. Quand fourni :
   *  - Insère un `backField` "Annonce" avec `changeMessage: "%@"` dans le pass
   *  - Au prochain APNs push, iOS refetch → détecte que la value a changé →
   *    affiche le contenu du message en notif lockscreen (au lieu du
   *    générique "Pass mis à jour")
   *
   * Source de vérité : `card_instances.last_campaign_message` en DB.
   * Persistée par /api/campaigns POST puis read au refetch APNs.
   */
  lastCampaignMessage?: string | null;
  /**
   * Date d'envoi du dernier message — ajoutée au label pour donner contexte
   * ("Annonce du 23/05/2026"). Évite que le client se demande quand le
   * message a été envoyé.
   */
  lastCampaignAt?: string | null;
  /**
   * La carte a-t-elle une photo de bande (design.banner_url) ? `false` pour
   * une carte Remise / VIP sans photo : pas de bande (elle serait vide, sans
   * tampons) et l'offre courte reprend sa place en grand (primaryFields).
   * Absent = considéré comme présent (comportement par défaut).
   */
  hasBanner?: boolean;
  /**
   * Lien vers le formulaire d'avis Google du commerce (demande d'avis
   * activée sur la carte). Affiché au verso — iOS rend les URLs des
   * backFields cliquables.
   */
  googleReviewUrl?: string | null;
  /**
   * Version de la bande (cf. {@link bannerVersionOf}) : casse le cache de
   * l'image quand le design change sans que le nombre de tampons change.
   */
  bannerVersion?: string | number | null;
}

const TEAM_ID = process.env.APPLE_TEAM_ID ?? "";
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID ?? "";
const WWDR_B64 = process.env.APPLE_WALLET_WWDR_BASE64 ?? "";
const SIGNER_CERT_B64 = process.env.APPLE_WALLET_SIGNER_CERT_BASE64 ?? "";
const SIGNER_KEY_B64 = process.env.APPLE_WALLET_SIGNER_KEY_BASE64 ?? "";
const SIGNER_KEY_PASSPHRASE = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE ?? "";
const AUTH_SECRET = process.env.APPLE_WALLET_AUTH_SECRET ?? "";

const ICONS_DIR = path.join(process.cwd(), "public", "apple-wallet");

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    TEAM_ID && PASS_TYPE_ID && WWDR_B64 && SIGNER_CERT_B64 && SIGNER_KEY_B64
  );
}

export function getApplePassTypeId(): string {
  return PASS_TYPE_ID;
}

/**
 * Génère un authenticationToken déterministe pour un pass donné.
 * HMAC-SHA256(serialNumber, APPLE_WALLET_AUTH_SECRET) -> on n'a pas besoin
 * de stocker le token : on peut le re-calculer à la volée pour vérifier
 * les requêtes signées par iOS (header `Authorization: ApplePass <token>`).
 */
export function computeApplePassAuthToken(serialNumber: string): string {
  if (!AUTH_SECRET) {
    throw new Error(
      "APPLE_WALLET_AUTH_SECRET is not configured — cannot compute pass auth token"
    );
  }
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(serialNumber)
    .digest("hex");
}

/**
 * Vérification timing-safe d'un authenticationToken reçu d'iOS.
 * Le format attendu du header est `ApplePass <token>` (cf. PassKit Web Service spec).
 */
export function verifyApplePassAuthHeader(
  authorizationHeader: string | null,
  serialNumber: string
): boolean {
  if (!authorizationHeader) return false;
  const m = /^ApplePass\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!m) return false;
  const provided = m[1].trim();
  let expected: string;
  try {
    expected = computeApplePassAuthToken(serialNumber);
  } catch {
    return false;
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function loadIconBuffers() {
  const names = [
    "icon.png",
    "icon@2x.png",
    "icon@3x.png",
    "logo.png",
    "logo@2x.png",
    "logo@3x.png",
  ];
  const out: Record<string, Buffer> = {};
  for (const n of names) {
    out[n] = fs.readFileSync(path.join(ICONS_DIR, n));
  }
  return out;
}

// Convertit "#10b981" en "rgb(16, 185, 129)" (Apple Wallet attend du rgb()).
function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return "rgb(16, 185, 129)";
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

// Calcule la luminance perçue d'une couleur hex (0..1). >0.6 = couleur claire.
// Sert au choix automatique de contraste pour le texte sur le pass.
function luminance(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex ?? "").trim());
  if (!m) return 0;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Choisit la couleur de texte la plus lisible sur un fond donné.
// - Fond clair (luminance > 0.6) -> texte noir
// - Fond sombre -> texte blanc
function autoForeground(bgHex: string): string {
  return luminance(bgHex) > 0.6
    ? "rgb(20, 20, 20)"
    : "rgb(255, 255, 255)";
}

// Récupère le logo du commerçant et le pousse comme logo.png Apple Wallet
// (top-left du pass). Si pas de logo merchant, on garde le logo aswallet
// générique de loadIconBuffers(). Apple accepte n'importe quelle taille tant
// que le PNG est valide — il scalera.
async function fetchMerchantLogo(
  logoUrl: string | null | undefined,
): Promise<{ "logo.png"?: Buffer; "logo@2x.png"?: Buffer; "logo@3x.png"?: Buffer; "icon.png"?: Buffer; "icon@2x.png"?: Buffer; "icon@3x.png"?: Buffer }> {
  if (!logoUrl) return {};
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(logoUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return {};
    let buf = Buffer.from(await res.arrayBuffer());
    // Apple Wallet exige du PNG dans le .pkpass. On vérifie la signature
    // PNG (0x89 0x50 0x4E 0x47) sur les premiers bytes du buffer plutôt
    // que de se fier au content-type (souvent inexact côté Supabase Storage).
    const isPng =
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47;
    if (!isPng) {
      // Filet de sécurité : si un ancien logo (HEIC/JPEG/WEBP) existe encore
      // dans le bucket avant la migration côté upload, on le convertit ici à la
      // volée plutôt que de retomber sur l'icône aswallet générique.
      try {
        const converted = await sharp(buf, { failOn: "none" })
          .rotate()
          .png()
          .toBuffer();
        buf = Buffer.from(converted);
      } catch (err) {
        console.warn(
          "[apple-wallet] merchant logo conversion failed, falling back to default icon:",
          err,
        );
        return {};
      }
    }
    return {
      "logo.png": buf,
      "logo@2x.png": buf,
      "logo@3x.png": buf,
      "icon.png": buf,
      "icon@2x.png": buf,
      "icon@3x.png": buf,
    };
  } catch (err) {
    console.warn("[apple-wallet] failed to fetch merchant logo:", err);
    return {};
  }
}

// Récupère le strip dynamique (PNG avec grille de tampons) depuis l'endpoint
// /api/wallet/banner — même image que pour Google Wallet, embed dans le .pkpass.
// Apple Wallet attend strip.png (320x123), strip@2x.png (640x246), strip@3x.png (960x369).
async function fetchStrip(
  appUrl: string,
  token: string,
  count: number,
  kind: CardKind,
  version?: string | number | null,
): Promise<{ "strip.png"?: Buffer; "strip@2x.png"?: Buffer; "strip@3x.png"?: Buffer }> {
  // Le banner endpoint peut rendre différemment selon le type :
  // - stamp/cashback : photo + grille de tampons
  // - discount/membership : photo seule (pas de compteur)
  // `v` : la bande change d'URL quand le design change (cache CDN contourné).
  const url = `${appUrl.replace(/\/$/, "")}${walletBannerPath(token, count, kind, version)}`;
  try {
    // 4s timeout — si l'endpoint plante, on génère le pass sans strip plutôt que d'échouer.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return {};
    const buf = Buffer.from(await res.arrayBuffer());
    // L'endpoint renvoie 1032x336 - assez large pour servir comme @3x. Apple
    // accepte qu'on fournisse uniquement la version la plus haute résolution
    // tant qu'elle a le bon ratio.
    return {
      "strip.png": buf,
      "strip@2x.png": buf,
      "strip@3x.png": buf,
    };
  } catch (err) {
    console.warn("[apple-wallet] failed to fetch strip:", err);
    return {};
  }
}

/** Prénom affiché « Bonjour <prénom> » : 1er mot, borné (la rangée est partagée). */
function greetingName(raw: string | null | undefined): string {
  const first = (raw ?? "").replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  return first.length > 16 ? `${first.slice(0, 15)}…` : first;
}

export interface ApplePassFields {
  headerFields: Field[];
  primaryFields: Field[];
  secondaryFields: Field[];
  auxiliaryFields: Field[];
  backFields: Field[];
}

/**
 * Champs du pass (storeCard), communs à TOUTES les cartes :
 *
 *   en-tête   : logo + nom du commerce (logoText) … « TAMPONS 2 / 10 » à droite
 *               (stamp / cashback uniquement — pas de compteur pour remise / VIP)
 *   bande     : strip.png (photo + grille de tampons), AUCUN champ par-dessus
 *   rangée    : « BONJOUR Shahin » TOUJOURS à gauche · « NOTRE OFFRE … » à droite
 *               (sans prénom : l'offre seule)
 *   QR        : « Propulsé par aswallet »
 *
 * Pure (aucun réseau / certificat) : testable sans les clés Apple.
 */
export function buildApplePassFields(
  p: Pick<
    ApplePassParams,
    | "cardId"
    | "cardName"
    | "cardKind"
    | "customerInstanceToken"
    | "customerFirstName"
    | "stampsCollected"
    | "stampsTotal"
    | "rewardText"
    | "appUrl"
    | "stampsLabel"
    | "lastCampaignMessage"
    | "lastCampaignAt"
    | "googleReviewUrl"
    | "hasBanner"
  >,
): ApplePassFields {
  const kind = normalizeCardKind(p.cardKind);
  const headerFields: Field[] = [];
  const primaryFields: Field[] = [];
  const secondaryFields: Field[] = [];
  const backFields: Field[] = [];

  // Compteur "X / Y" UNIQUEMENT pour stamp/cashback. Avant ce check, les
  // cartes Discount/Membership affichaient "Tampons 0/8" ce qui n'avait
  // aucun sens (Membership = pas de compteur, Discount = avantage permanent).
  if (isCounterKind(kind)) {
    headerFields.push({
      key: "points",
      // Pour cashback, le label par défaut est "Visites" plutôt que "Tampons".
      label: shortLabel(p.stampsLabel, kind === "cashback" ? "Visites" : "Tampons", 14),
      value: `${p.stampsCollected} / ${p.stampsTotal}`,
      textAlignment: "PKTextAlignmentRight",
    });
  }

  // Rangée sous la bande : « Bonjour <prénom> » à GAUCHE puis l'offre à
  // DROITE, dans cet ordre, sur la même rangée (secondaryFields). Plus rien
  // en primaryFields : sur une storeCard ils se posent PAR-DESSUS la bande et
  // masquaient la photo / les tampons. L'offre complète est aussi au verso.
  // Espaces normalisés, insécables conservés (« −10 % » ne se coupe pas).
  const reward = (p.rewardText ?? "").replace(/[^\S  ]+/g, " ").trim();
  const firstName = greetingName(p.customerFirstName);
  if (firstName) {
    secondaryFields.push({
      key: "card",
      label: "Bonjour",
      value: firstName,
      textAlignment: "PKTextAlignmentLeft",
    });
  }
  // Remise / VIP sans photo : il n'y a pas de bande, l'offre courte (≤ 18
  // car.) s'affiche en grand comme avant la refonte.
  const offerAsPrimary =
    !isCounterKind(kind) && p.hasBanner === false && reward.length > 0 && reward.length <= 18;
  if (offerAsPrimary) {
    primaryFields.push({ key: "offer", label: "Notre offre", value: reward });
  } else if (reward) {
    secondaryFields.push({
      key: "offer",
      label: "Notre offre",
      value: reward,
      textAlignment: firstName ? "PKTextAlignmentRight" : "PKTextAlignmentLeft",
    });
  }

  backFields.push(
    { key: "card-name", label: "Carte", value: p.cardName },
    { key: "reward-text", label: "Récompense", value: p.rewardText },
  );

  // Field "Annonce" — déclenche la notif lockscreen iOS avec le contenu du
  // message. Placé en TÊTE des backFields (juste après les infos carte de
  // base) pour qu'il soit visible immédiatement au verso. `changeMessage`
  // = "%@" signifie : quand la value de ce field change vs le pass local,
  // iOS affiche EXACTEMENT cette value en notification riche.
  //
  // IMPORTANT : le field DOIT exister dans TOUS les passes (avec value vide
  // ou message par défaut) sinon iOS ne peut pas comparer "old vs new" et
  // n'affichera pas la notif. C'est pourquoi on insère le field même quand
  // lastCampaignMessage est null/vide — avec une value placeholder discrète.
  const announcementMessage = (p.lastCampaignMessage ?? "").trim();
  const announcementValue =
    announcementMessage.length > 0 ? announcementMessage : "Aucune annonce pour le moment.";
  const announcementLabel = (() => {
    if (!p.lastCampaignAt) return "Annonce";
    try {
      const d = new Date(p.lastCampaignAt);
      const formatted = new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);
      return `Annonce du ${formatted}`;
    } catch {
      return "Annonce";
    }
  })();
  backFields.push({
    key: "announcement",
    label: announcementLabel,
    value: announcementValue,
    changeMessage: "%@",
  });

  if (p.googleReviewUrl) {
    backFields.push({
      key: "google-review",
      label: "Laissez-nous un avis Google ⭐",
      value: p.googleReviewUrl,
    });
  }

  backFields.push(
    {
      key: "view-online",
      label: "Voir ma carte en ligne",
      value: `${p.appUrl}/c/${p.cardId}/status/${p.customerInstanceToken}`,
    },
    { key: "support", label: "Support", value: "contact@aswallet.fr" },
  );

  return { headerFields, primaryFields, secondaryFields, auxiliaryFields: [], backFields };
}

export async function generateApplePassBuffer(p: ApplePassParams): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("Apple Wallet not configured");
  }

  // `rewardsAvailable` n'est plus rendu visuellement (suppression du slot
  // "Récompenses dispo"), mais on garde le champ dans la signature pour
  // compat avec les call-sites qui le passent toujours.
  void p.rewardsAvailable;

  // Parallel fetch : merchant logo + strip image (gain de temps).
  const passKind = normalizeCardKind(p.cardKind);
  // Remise / VIP sans photo : pas de strip (l'image serait entièrement vide).
  const withStrip = isCounterKind(passKind) || p.hasBanner !== false;
  const [merchantLogo, stripBuffers] = await Promise.all([
    fetchMerchantLogo(p.logoUrl),
    withStrip
      ? fetchStrip(p.appUrl, p.customerInstanceToken, p.stampsCollected, passKind, p.bannerVersion)
      : Promise.resolve({}),
  ]);
  // Order matters: defaults first, merchant logo overrides them, strip last.
  const buffers = { ...loadIconBuffers(), ...merchantLogo, ...stripBuffers };
  // Apple Wallet : 3 couleurs pilotables via pass.json :
  //  - backgroundColor : fond du pass (couleur dominante derrière le contenu)
  //  - foregroundColor : texte des VALEURS des fields (gros, central)
  //  - labelColor      : texte des LABELS au-dessus des valeurs (petit, uppercase)
  //
  // Stratégie : si le merchant a choisi un text_color explicite, on l'utilise
  // pour foregroundColor. Sinon on auto-contraste selon le fond (texte noir
  // sur fond clair, blanc sur fond sombre). labelColor suit le même choix
  // mais avec une opacité visuelle réduite (Apple gère le rendu).
  //
  // Cas user "fond blanc + texte blanc" -> auto-fix : on force foreground
  // noir car luminance(white) > 0.6.
  // Apple Wallet RESPECTE le choix du merchant — c'est une force d'Apple
  // d'accepter foregroundColor + backgroundColor + labelColor custom (fond
  // clair + texte sombre = parfaitement valide ici).
  //
  // Google Wallet ne peut pas en faire autant : Google force le texte en
  // blanc, donc on auto-flippe le fond vers sombre côté Google uniquement
  // (cf. `googleEffectiveBgColor`). Conséquence assumée : si le merchant
  // choisit un fond clair, Apple rendra clair + texte sombre, Google rendra
  // sombre + texte blanc — DIFFÉRENT mais chacun OPTIMAL pour sa plateforme.
  // Le designer affiche clairement les deux previews via le toggle pour que
  // le merchant ne soit pas surpris.
  const bgColor = hexToRgb(p.backgroundColor);
  const textColorHex =
    p.textColor && p.textColor.trim().length > 0
      ? p.textColor.trim()
      : null;
  const fgColor = textColorHex
    ? hexToRgb(textColorHex)
    : autoForeground(p.backgroundColor);
  const labelColor = fgColor;

  // PassKit Web Service : si on a un AUTH_SECRET, on embarque le webServiceURL
  // et un authenticationToken par-pass pour activer les live updates via APNs.
  // Sans secret configuré, on retombe sur l'ancien comportement (pass figé).
  const liveUpdateProps = AUTH_SECRET
    ? {
        webServiceURL: `${p.appUrl.replace(/\/$/, "")}/api/apple-wallet`,
        authenticationToken: computeApplePassAuthToken(p.customerInstanceToken),
      }
    : {};

  const pass = new PKPass(
    buffers,
    {
      wwdr: Buffer.from(WWDR_B64, "base64"),
      signerCert: Buffer.from(SIGNER_CERT_B64, "base64"),
      signerKey: Buffer.from(SIGNER_KEY_B64, "base64"),
      signerKeyPassphrase: SIGNER_KEY_PASSPHRASE || undefined,
    },
    {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      serialNumber: p.customerInstanceToken,
      // Apple n'affiche jamais `description` visuellement — c'est utilisé
      // par Spotlight Search et VoiceOver. Juste le nom de la carte suffit
      // (avant: "Carte fidélité — Demo aswallet" → polluait le résultat de
      // recherche avec le nom interne du business).
      description: p.cardName,
      organizationName: p.businessName,
      foregroundColor: fgColor,
      backgroundColor: bgColor,
      labelColor,
      // Top-left du pass : par défaut on affiche le NOM DE LA CARTE (Suprême
      // Tacos, Carte café, etc.) car c'est ce que les merchants attendent —
      // c'est leur marque produit. Le nom du business interne n'apparaît plus
      // que si l'utilisateur force via wallet_business_name (ex: franchise
      // qui veut afficher le nom de l'enseigne sur toutes ses cartes).
      logoText:
        (p.walletBusinessName && p.walletBusinessName.trim()) ||
        p.cardName ||
        p.businessName,
      // Apple Wallet : un pass peut embarquer jusqu'à 10 locations. iOS
      // déclenche une notification sur l'écran verrouillé quand le porteur
      // entre dans un rayon de ~100m d'un de ces points (sans ouvrir l'app).
      ...(p.locations && p.locations.length > 0
        ? {
            locations: p.locations.slice(0, 10).map((l) => ({
              latitude: l.latitude,
              longitude: l.longitude,
              ...(l.relevantText && l.relevantText.trim()
                ? { relevantText: l.relevantText.trim().slice(0, 200) }
                : {}),
            })),
          }
        : {}),
      ...liveUpdateProps,
    }
  );

  // Type "storeCard" = carte de fidélité Apple Wallet (avec strip image visuelle).
  // Champs construits par buildApplePassFields (ordre et règles communs à
  // toutes les cartes, testables sans certificat).
  pass.type = "storeCard";

  const fields = buildApplePassFields(p);
  pass.headerFields.push(...fields.headerFields);
  pass.primaryFields.push(...fields.primaryFields);
  pass.secondaryFields.push(...fields.secondaryFields);
  pass.auxiliaryFields.push(...fields.auxiliaryFields);
  pass.backFields.push(...fields.backFields);

  // QR code lisible par l'app scanner du commerçant. altText apparaît
  // sous le QR — on remplace le serial number (chaîne aléatoire pas
  // parlante) par un crédit "Propulsé par aswallet".
  pass.setBarcodes({
    message: p.customerInstanceToken,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: "Propulsé par aswallet",
  });

  return pass.getAsBuffer();
}
