// Try to create a specific card class via the Wallet API to see the actual error.
// Usage: node scripts/debug-card-class.mjs <cardId> <issuerName> <programName> <logoUrl> <bgHex>
import { GoogleAuth } from "google-auth-library";

const [cardId, issuerName, programName, logoUrl, bgHex] = process.argv.slice(2);
if (!cardId) {
  console.error("Usage: node scripts/debug-card-class.mjs <cardId> [issuerName] [programName] [logoUrl] [bgHex]");
  process.exit(1);
}

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";
const CLASS_ID = `${ISSUER_ID}.card-${cardId}`;

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const client = await auth.getClient();

const classBody = {
  id: CLASS_ID,
  issuerName: issuerName || "Test Business",
  programName: programName || "Test Program",
  hexBackgroundColor: bgHex || "#10b981",
  countryCode: "FR",
  reviewStatus: "UNDER_REVIEW",
  rewardsTier: "Standard",
  rewardsTierLabel: "Programme",
  accountIdLabel: "Client",
  accountNameLabel: "Nom",
  programDetails: "Test programDetails",
  ...(logoUrl ? {
    programLogo: {
      sourceUri: { uri: logoUrl },
      contentDescription: { defaultValue: { language: "fr", value: issuerName || "logo" } },
    },
  } : {}),
};

// GET first to see if already exists
try {
  const get = await client.request({ url: `${BASE_URL}/loyaltyClass/${CLASS_ID}`, method: "GET" });
  console.log("Class already exists on Google side:");
  console.log(JSON.stringify({ id: get.data.id, reviewStatus: get.data.reviewStatus }, null, 2));
  process.exit(0);
} catch (e) {
  if (e?.response?.status !== 404) {
    console.log("GET failed (not 404):", JSON.stringify(e?.response?.data ?? e.message, null, 2));
    process.exit(1);
  }
  console.log(`Class ${CLASS_ID} does not exist on Google side. Attempting POST...`);
}

try {
  const insert = await client.request({
    url: `${BASE_URL}/loyaltyClass`,
    method: "POST",
    data: classBody,
  });
  console.log("\nPOST succeeded:");
  console.log(JSON.stringify({ id: insert.data.id, reviewStatus: insert.data.reviewStatus }, null, 2));
} catch (e) {
  console.log("\nPOST FAILED:");
  console.log(JSON.stringify(e?.response?.data ?? e.message, null, 2));
  process.exit(1);
}
