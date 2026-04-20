import jwt from "jsonwebtoken";

interface PassParams {
  cardId: string;
  cardName: string;
  businessName: string;
  customerName: string;
  customerInstanceToken: string;
  stampsCollected: number;
  stampsTotal: number;
  rewardsAvailable: number;
  rewardText: string;
  bgColor: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  appUrl: string;
  barcodeType?: "qr" | "pdf417";
}

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID!;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!;
const PRIVATE_KEY = (process.env.GOOGLE_WALLET_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

export function isGoogleWalletConfigured(): boolean {
  return Boolean(ISSUER_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);
}

function classId(cardId: string): string {
  return `${ISSUER_ID}.card-${cardId}`;
}

function objectId(instanceToken: string): string {
  return `${ISSUER_ID}.user-${instanceToken}`;
}

function buildLoyaltyClass(p: PassParams) {
  return {
    id: classId(p.cardId),
    issuerName: p.businessName,
    programName: p.cardName,
    programLogo: p.logoUrl
      ? {
          sourceUri: { uri: p.logoUrl },
          contentDescription: {
            defaultValue: { language: "fr", value: p.businessName },
          },
        }
      : undefined,
    heroImage: p.bannerUrl
      ? {
          sourceUri: { uri: p.bannerUrl },
          contentDescription: {
            defaultValue: { language: "fr", value: p.cardName },
          },
        }
      : undefined,
    hexBackgroundColor: p.bgColor,
    countryCode: "FR",
    reviewStatus: "UNDER_REVIEW",
    rewardsTier: "Standard",
    rewardsTierLabel: "Programme",
    accountIdLabel: "Client",
    accountNameLabel: "Nom",
    programDetails: p.rewardText,
  };
}

function buildLoyaltyObject(p: PassParams) {
  const homepageUri = `${p.appUrl}/c/${p.cardId}/status/${p.customerInstanceToken}`;

  return {
    id: objectId(p.customerInstanceToken),
    classId: classId(p.cardId),
    state: "ACTIVE",
    accountId: p.customerInstanceToken,
    accountName: p.customerName,
    loyaltyPoints: {
      balance: { int: p.stampsCollected },
      label: "Tampons",
    },
    secondaryLoyaltyPoints: {
      balance: { int: p.rewardsAvailable },
      label: "Recompenses",
    },
    barcode: {
      type: p.barcodeType === "pdf417" ? "PDF_417" : "QR_CODE",
      value: p.customerInstanceToken,
      alternateText: p.customerInstanceToken.slice(0, 8),
    },
    linksModuleData: {
      uris: [
        {
          uri: homepageUri,
          description: "Voir ma carte",
          id: "open-card",
        },
      ],
    },
    textModulesData: [
      {
        header: "Recompense",
        body: p.rewardText,
        id: "reward",
      },
    ],
  };
}

export function generateGoogleWalletPassUrl(p: PassParams): string {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet not configured");
  }

  const claims = {
    iss: SERVICE_ACCOUNT_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [p.appUrl],
    payload: {
      loyaltyClasses: [buildLoyaltyClass(p)],
      loyaltyObjects: [buildLoyaltyObject(p)],
    },
  };

  const token = jwt.sign(claims, PRIVATE_KEY, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}
