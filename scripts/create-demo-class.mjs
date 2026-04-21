import { GoogleAuth } from "google-auth-library";

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const CLASS_SUFFIX = "fidpass-demo"; // on garde l'ID Google Wallet existant pour ne pas casser la class deja creee
const CLASS_ID = `${ISSUER_ID}.${CLASS_SUFFIX}`;

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});

const client = await auth.getClient();
const baseUrl = "https://walletobjects.googleapis.com/walletobjects/v1";

const classBody = {
  id: CLASS_ID,
  issuerName: "aswallet",
  programName: "aswallet Demo Loyalty",
  reviewStatus: "DRAFT",
  hexBackgroundColor: "#10b981",
  countryCode: "FR",
  localizedIssuerName: {
    defaultValue: { language: "fr", value: "aswallet" },
  },
  localizedProgramName: {
    defaultValue: { language: "fr", value: "aswallet Demo" },
  },
  programLogo: {
    sourceUri: {
      uri: "https://wallet-business-blond.vercel.app/icon.svg",
    },
    contentDescription: {
      defaultValue: { language: "fr", value: "aswallet" },
    },
  },
  rewardsTier: "Standard",
  rewardsTierLabel: "Programme",
  accountIdLabel: "Client ID",
  accountNameLabel: "Nom",
  programDetails: "Carte de fidelite digitale aswallet.",
};

// Try GET first to check if exists
try {
  const get = await client.request({
    url: `${baseUrl}/loyaltyClass/${CLASS_ID}`,
    method: "GET",
  });
  console.log("Class already exists:");
  console.log("  id:", get.data.id);
  console.log("  reviewStatus:", get.data.reviewStatus);
  process.exit(0);
} catch (e) {
  if (e?.response?.status !== 404) {
    console.log("GET failed (not 404):", e?.response?.data ?? e.message);
    process.exit(1);
  }
  console.log("Class does not exist yet, creating...");
}

try {
  const insert = await client.request({
    url: `${baseUrl}/loyaltyClass`,
    method: "POST",
    data: classBody,
  });
  console.log("\nClass created successfully:");
  console.log("  id:", insert.data.id);
  console.log("  reviewStatus:", insert.data.reviewStatus);
  console.log("\nNow you can click 'Demander l'acces en publication' on the Wallet Console.");
} catch (e) {
  console.log("Insert failed:");
  console.log(JSON.stringify(e?.response?.data ?? e.message, null, 2));
  process.exit(1);
}
