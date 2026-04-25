import { PKPass } from "passkit-generator";
import fs from "node:fs";
import path from "node:path";

interface ApplePassParams {
  cardId: string;
  cardName: string;
  businessName: string;
  customerInstanceToken: string;
  stampsCollected: number;
  stampsTotal: number;
  rewardsAvailable: number;
  rewardText: string;
  bgColor: string; // hex like "#10b981"
  appUrl: string;
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

export async function generateApplePassBuffer(p: ApplePassParams): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("Apple Wallet not configured");
  }

  const buffers = loadIconBuffers();
  const bgColor = hexToRgb(p.bgColor);

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

  // Type "storeCard" = carte de fidélité Apple Wallet (avec strip image visuelle)
  pass.type = "storeCard";
  pass.headerFields.push({
    key: "stamps",
    label: "Tampons",
    value: `${p.stampsCollected} / ${p.stampsTotal}`,
  });
  pass.primaryFields.push({
    key: "reward",
    label: "Récompense",
    value: p.rewardText,
  });
  pass.secondaryFields.push({
    key: "rewards-available",
    label: "Récompenses disponibles",
    value: String(p.rewardsAvailable),
  });
  pass.backFields.push(
    {
      key: "card-name",
      label: "Carte",
      value: p.cardName,
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
