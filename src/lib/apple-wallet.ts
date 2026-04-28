import { PKPass } from "passkit-generator";
import fs from "node:fs";
import path from "node:path";

interface ApplePassParams {
  cardId: string;
  cardName: string;
  businessName: string;
  customerInstanceToken: string;
  customerFirstName?: string | null;
  stampsCollected: number;
  stampsTotal: number;
  rewardsAvailable: number;
  rewardText: string;
  /** Couleur de FOND du pass (la couleur dominante derrière tout le contenu). */
  backgroundColor: string;
  /** Couleur d'accent (texte secondaire, icônes des tampons remplis). */
  accentColor?: string;
  appUrl: string;
  /** Merchant's logo (carré idéalement) — affiché top-left du pass Apple. */
  logoUrl?: string | null;
}

const TEAM_ID = process.env.APPLE_TEAM_ID ?? "";
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID ?? "";
const WWDR_B64 = process.env.APPLE_WALLET_WWDR_BASE64 ?? "";
const SIGNER_CERT_B64 = process.env.APPLE_WALLET_SIGNER_CERT_BASE64 ?? "";
const SIGNER_KEY_B64 = process.env.APPLE_WALLET_SIGNER_KEY_BASE64 ?? "";
const SIGNER_KEY_PASSPHRASE = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE ?? "";

const ICONS_DIR = path.join(process.cwd(), "public", "apple-wallet");

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    TEAM_ID && PASS_TYPE_ID && WWDR_B64 && SIGNER_CERT_B64 && SIGNER_KEY_B64
  );
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
    const buf = Buffer.from(await res.arrayBuffer());
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
      console.warn(
        "[apple-wallet] merchant logo is not PNG — ignoring (uploadez un PNG pour personnaliser le logo Apple Wallet)",
      );
      return {};
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

  // Parallel fetch : merchant logo + strip image (gain de temps).
  const [merchantLogo, stripBuffers] = await Promise.all([
    fetchMerchantLogo(p.logoUrl),
    fetchStrip(p.appUrl, p.customerInstanceToken, p.stampsCollected),
  ]);
  // Order matters: defaults first, merchant logo overrides them, strip last.
  const buffers = { ...loadIconBuffers(), ...merchantLogo, ...stripBuffers };
  // Apple attend `backgroundColor` (la teinte dominante du pass) et
  // `labelColor` (couleur des labels des fields). Le bg = la couleur que le
  // merchant a explicitement choisie pour fond. labelColor = blanc forcé
  // pour rester lisible sur tous fonds (Apple ajuste foregroundColor seul).
  const bgColor = hexToRgb(p.backgroundColor);

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
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: bgColor,
      labelColor: "rgb(255, 255, 255)",
      logoText: p.businessName,
    }
  );

  // Type "storeCard" = carte de fidélité Apple Wallet (avec strip image visuelle).
  // Stratégie de mise en page (référence: KFC, Boomerangme):
  //  - logoText (top-left, à côté du logo)            -> nom du commerce
  //  - headerFields (top-right)                        -> compteur "X / Y"
  //  - primaryFields (par-dessus le strip)             -> VIDE (le strip image
  //                                                       contient déjà la grille
  //                                                       de tampons; on évite
  //                                                       toute superposition)
  //  - secondaryFields (entre primary et auxiliary)    -> "Bonjour <prénom>"
  //  - auxiliaryFields (sous le strip)                 -> prochaine récompense
  //                                                       + récompenses dispo
  //  - backFields (verso, accessible via "...")        -> détails complets
  pass.type = "storeCard";

  pass.headerFields.push({
    key: "points",
    label: "Tampons",
    value: `${p.stampsCollected} / ${p.stampsTotal}`,
  });

  // primaryFields volontairement VIDE — le strip image porte déjà la grille de
  // tampons et toute autre info textuelle créerait un chevauchement visuel.

  if (p.customerFirstName && p.customerFirstName.trim().length > 0) {
    pass.secondaryFields.push({
      key: "card",
      label: "Bonjour",
      value: p.customerFirstName.trim(),
    });
  }

  const remaining = Math.max(0, p.stampsTotal - p.stampsCollected);
  pass.auxiliaryFields.push(
    {
      key: "till-reward",
      label: "Prochaine récompense",
      value: `${remaining} tampons`,
    },
    {
      key: "rewards-available",
      label: "Récompenses dispo",
      value: String(p.rewardsAvailable),
    },
  );

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

  // QR code lisible par l'app scanner du commerçant.
  pass.setBarcodes({
    message: p.customerInstanceToken,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: p.customerInstanceToken.slice(0, 8),
  });

  return pass.getAsBuffer();
}
