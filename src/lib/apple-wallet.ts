import { PKPass } from "passkit-generator";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

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

interface ApplePassParams {
  cardId: string;
  cardName: string;
  businessName: string;
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
   * Points de vente du commerce. Apple PassKit affiche une notif sur l'écran
   * verrouillé quand le porteur passe dans un rayon de ~100m. Max 10.
   */
  locations?: PassLocation[];
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
): Promise<{ "strip.png"?: Buffer; "strip@2x.png"?: Buffer; "strip@3x.png"?: Buffer }> {
  const url = `${appUrl}/api/wallet/banner/${token}/${count}`;
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

export async function generateApplePassBuffer(p: ApplePassParams): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("Apple Wallet not configured");
  }

  // `rewardsAvailable` n'est plus rendu visuellement (suppression du slot
  // "Récompenses dispo"), mais on garde le champ dans la signature pour
  // compat avec les call-sites qui le passent toujours.
  void p.rewardsAvailable;

  // Parallel fetch : merchant logo + strip image (gain de temps).
  const [merchantLogo, stripBuffers] = await Promise.all([
    fetchMerchantLogo(p.logoUrl),
    fetchStrip(p.appUrl, p.customerInstanceToken, p.stampsCollected),
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
  const bgColor = hexToRgb(p.backgroundColor);
  const textColorHex =
    p.textColor && p.textColor.trim().length > 0
      ? p.textColor.trim()
      : null;
  const fgColor = textColorHex
    ? hexToRgb(textColorHex)
    : autoForeground(p.backgroundColor);
  // labelColor : on prend la même teinte que foreground mais légèrement
  // dégradée (Apple les rend en uppercase + plus petit, donc on doit garantir
  // qu'ils restent lisibles). Pour simplicité on les garde identiques au fg.
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
      description: `${p.cardName} — ${p.businessName}`,
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
  // Stratégie de mise en page simplifiée (post-relaunch pricing) :
  //  - logoText (top-left, à côté du logo)            -> nom du commerce
  //  - headerFields (top-right)                        -> compteur "X / Y"
  //  - primaryFields (par-dessus le strip)             -> "Notre offre" si court
  //                                                       (≤ 18 chars), sinon vide
  //  - secondaryFields                                 -> "Bonjour <prénom>" + offre
  //                                                       (selon longueur)
  //  - auxiliaryFields                                 -> "Notre offre" (long)
  //  - backFields (verso, accessible via "...")        -> détails complets
  //
  // On a explicitement RETIRÉ "Prochaine récompense" (X tampons restants) et
  // "Récompenses dispo" (toujours 0 sur cartes neuves) — ces deux slots
  // surchargeaient la carte sans valeur informationnelle pour le client.
  pass.type = "storeCard";

  pass.headerFields.push({
    key: "points",
    label: "Tampons",
    value: `${p.stampsCollected} / ${p.stampsTotal}`,
  });

  // Récompense : un SEUL champ "Notre offre" dont la taille s'adapte.
  // Apple rend chaque slot à une taille différente (primary > secondary >
  // auxiliary) → en plaçant l'offre dans le slot le plus haut quand elle est
  // courte, on la rend automatiquement plus grosse sans CSS.
  //
  //   ≤ 18 chars  → primaryFields  → texte ÉNORME ("Café offert")
  //   19 → 32     → secondaryFields → texte moyen ("9 cafés = 1 offert")
  //   33 +        → auxiliaryFields → petit (cas "12 tampons = 1 sandwich à 6,60€")
  const reward = (p.rewardText ?? "").trim();
  const firstName = (p.customerFirstName ?? "").trim();

  let rewardSlot: "primary" | "secondary" | "auxiliary" | null = null;
  if (reward.length > 0) {
    if (reward.length <= 18) rewardSlot = "primary";
    else if (reward.length <= 32) rewardSlot = "secondary";
    else rewardSlot = "auxiliary";
  }

  // "Bonjour {firstName}" en secondaryFields (sauf si l'offre y est déjà,
  // auquel cas on bascule en auxiliaryFields pour ne pas saturer la rangée).
  if (firstName.length > 0) {
    if (rewardSlot === "secondary") {
      pass.auxiliaryFields.push({
        key: "card",
        label: "Bonjour",
        value: firstName,
      });
    } else {
      pass.secondaryFields.push({
        key: "card",
        label: "Bonjour",
        value: firstName,
      });
    }
  }

  if (rewardSlot === "primary") {
    pass.primaryFields.push({
      key: "offer",
      label: "Notre offre",
      value: reward,
    });
  } else if (rewardSlot === "secondary") {
    pass.secondaryFields.push({
      key: "offer",
      label: "Notre offre",
      value: reward,
    });
  } else if (rewardSlot === "auxiliary") {
    pass.auxiliaryFields.push({
      key: "offer",
      label: "Notre offre",
      value: reward,
    });
  }

  pass.backFields.push(
    {
      key: "card-name",
      label: "Carte",
      value: p.cardName,
    },
    {
      key: "reward-text",
      label: "Récompense",
      value: p.rewardText,
    },
    {
      key: "view-online",
      label: "Voir ma carte en ligne",
      value: `${p.appUrl}/c/${p.cardId}/status/${p.customerInstanceToken}`,
    },
    {
      key: "support",
      label: "Support",
      value: "contact@aswallet.fr",
    }
  );

  // QR code lisible par l'app scanner du commerçant. altText apparaît
  // sous le QR — on remplace le serial number (chaîne aléatoire pas
  // parlante) par un crédit "Signé par aswallet".
  pass.setBarcodes({
    message: p.customerInstanceToken,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: "Signé par aswallet",
  });

  return pass.getAsBuffer();
}
