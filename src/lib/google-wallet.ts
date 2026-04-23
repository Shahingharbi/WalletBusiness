import jwt from "jsonwebtoken";
import { GoogleAuth } from "google-auth-library";

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

// Google Wallet refuses a LoyaltyClass without a programLogo.
// Fallback to the aswallet icon when a merchant has not uploaded one.
const FALLBACK_LOGO_URL = "https://aswallet.fr/icon.svg";

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
  const logoUri = p.logoUrl ?? FALLBACK_LOGO_URL;
  return {
    id: classId(p.cardId),
    issuerName: p.businessName,
    programName: p.cardName,
    programLogo: {
      sourceUri: { uri: logoUri },
      contentDescription: {
        defaultValue: { language: "fr", value: p.businessName },
      },
    },
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

function bannerUri(appUrl: string, token: string, stamps: number): string {
  return `${appUrl}/api/wallet/banner/${token}/${stamps}`;
}

function buildLoyaltyObject(p: PassParams) {
  const homepageUri = `${p.appUrl}/c/${p.cardId}/status/${p.customerInstanceToken}`;

  return {
    id: objectId(p.customerInstanceToken),
    classId: classId(p.cardId),
    state: "ACTIVE",
    accountId: p.customerInstanceToken,
    accountName: p.customerName,
    // Per-user heroImage: dynamic PNG with the visual stamp grid.
    // URL includes the stamp count for cache-busting so Google re-fetches
    // when the count changes. Overrides any class-level heroImage.
    heroImage: {
      sourceUri: {
        uri: bannerUri(
          p.appUrl,
          p.customerInstanceToken,
          p.stampsCollected,
        ),
      },
      contentDescription: {
        defaultValue: { language: "fr", value: "Progression" },
      },
    },
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

// Google Wallet: push updated stamps/rewards to an existing loyaltyObject.
// Called after /api/scan so users who added the card to Wallet see fresh counts.
// Silently no-ops on 404 (user never added to Wallet yet) or on timeout.
export async function syncLoyaltyObject(
  instanceToken: string,
  stampsCollected: number,
  rewardsAvailable: number,
  appUrl: string
): Promise<void> {
  if (!isGoogleWalletConfigured()) return;

  const objId = objectId(instanceToken);
  const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objId}`;
  const body = {
    loyaltyPoints: { balance: { int: stampsCollected }, label: "Tampons" },
    secondaryLoyaltyPoints: {
      balance: { int: rewardsAvailable },
      label: "Recompenses",
    },
    // New stamp count in the URL path → Google re-fetches the image.
    heroImage: {
      sourceUri: {
        uri: bannerUri(appUrl, instanceToken, stampsCollected),
      },
      contentDescription: {
        defaultValue: { language: "fr", value: "Progression" },
      },
    },
  };

  const auth = new GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });

  try {
    const client = await auth.getClient();
    await client.request({ url, method: "PATCH", data: body, timeout: 3000 });
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return; // user has not saved the pass yet, normal
    console.warn(
      `[wallet-sync] PATCH ${objId} failed:`,
      (err as { message?: string })?.message ?? err
    );
  }
}
