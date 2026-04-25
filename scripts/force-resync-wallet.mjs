// Force-resync de tous les loyaltyObjects Google Wallet pour qu'ils refetch
// le nouveau heroImage (banner avec design custom). À runner UNE FOIS après
// avoir corrigé le rendu du banner. Utile aussi quand on change le design
// de la carte côté merchant et qu'on veut propager.
//
// Usage: node scripts/force-resync-wallet.mjs
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
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SR_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = env.NEXT_PUBLIC_APP_URL || "https://aswallet.fr";

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const client = await auth.getClient();

// 1. List all card_instances
const res = await fetch(
  `${SB_URL}/rest/v1/card_instances?select=token,stamps_collected,rewards_available&status=eq.active`,
  { headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}` } },
);
const instances = await res.json();
console.log(`Found ${instances.length} active card_instances\n`);

let synced = 0;
let notFound = 0;
let failed = 0;

for (const inst of instances) {
  const objId = `${ISSUER_ID}.user-${inst.token}`;
  const url = `${BASE_URL}/loyaltyObject/${objId}`;
  const bannerUri = `${APP_URL}/api/wallet/banner/${inst.token}/${inst.stamps_collected}`;

  const body = {
    loyaltyPoints: { balance: { int: inst.stamps_collected }, label: "Tampons" },
    secondaryLoyaltyPoints: {
      balance: { int: inst.rewards_available },
      label: "Récompenses",
    },
    heroImage: {
      sourceUri: { uri: bannerUri },
      contentDescription: { defaultValue: { language: "fr", value: "Progression" } },
    },
    // Triggering message bumps Google's push so the user's phone refreshes.
    messages: [
      {
        id: `force-resync-${Date.now()}`,
        header: "Mise à jour",
        body: "Votre carte a été rafraîchie avec un nouveau design.",
        messageType: "TEXT",
      },
    ],
  };

  try {
    await client.request({ url, method: "PATCH", data: body, timeout: 5000 });
    console.log(`  [synced ] ${inst.token.slice(0, 8)}…`);
    synced++;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404) {
      notFound++;
      // user just hasn't added the card to wallet yet — that's fine
    } else {
      console.log(
        `  [FAILED ] ${inst.token.slice(0, 8)}… status=${status} msg=${e?.message ?? e}`,
      );
      failed++;
    }
  }
}

console.log(`\nDone. synced=${synced} not_in_wallet=${notFound} failed=${failed}`);
