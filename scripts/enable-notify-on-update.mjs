// PATCH toutes les LoyaltyClass existantes côté Google Wallet pour activer
// `notifyPreference: NOTIFY_ON_UPDATE`. Sans ce flag, les PATCHs des objets
// (après scan, campagne, etc.) sont propagés silencieusement → le tel ne
// rafraîchit pas la carte tant que l'app n'est pas rouverte.
//
// À runner UNE FOIS après le déploiement pour rattraper les classes créées
// avant ce changement. Les nouvelles classes auront le flag direct.

import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "node:fs";

function loadEnv() {
  const raw = readFileSync("./.env.local", "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv();
const ISSUER_ID = env.GOOGLE_WALLET_ISSUER_ID;
const KEY_FILE = "./google-wallet-key.json";
const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";

if (!ISSUER_ID) {
  console.error("GOOGLE_WALLET_ISSUER_ID manquant dans .env.local");
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const client = await auth.getClient();

// Liste les classes de l'issuer
const list = await client.request({
  url: `${BASE_URL}/loyaltyClass?issuerId=${ISSUER_ID}&maxResults=200`,
  method: "GET",
});
const classes = list.data?.resources ?? [];
console.log(`Found ${classes.length} loyaltyClass for issuer ${ISSUER_ID}\n`);

let patched = 0;
let skipped = 0;
let failed = 0;
for (const c of classes) {
  const id = c.id;
  const current = c.notifyPreference;
  if (current === "NOTIFY_ON_UPDATE") {
    console.log(`  [skipped] ${id} déjà NOTIFY_ON_UPDATE`);
    skipped++;
    continue;
  }
  try {
    await client.request({
      url: `${BASE_URL}/loyaltyClass/${id}`,
      method: "PATCH",
      // reviewStatus est obligatoire dans le body du PATCH côté Google.
      // L'issuer étant déjà approuvé en production, soumettre UNDER_REVIEW
      // = re-validation instantanée et automatique.
      data: {
        notifyPreference: "NOTIFY_ON_UPDATE",
        reviewStatus: "UNDER_REVIEW",
      },
    });
    console.log(`  [patched] ${id}`);
    patched++;
  } catch (err) {
    console.log(
      `  [FAILED ] ${id} :`,
      err?.response?.data?.error?.message ?? err?.message ?? err,
    );
    failed++;
  }
}

console.log(
  `\nDone. patched=${patched} skipped=${skipped} failed=${failed} total=${classes.length}`,
);
