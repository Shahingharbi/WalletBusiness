// Sync all active cards from Supabase as Google Wallet loyalty classes.
// Creates the class via the Wallet API (more reliable than JWT-embedded creation).
// Usage: node scripts/sync-wallet-classes.mjs
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "node:fs";

function parseEnv() {
  const raw = readFileSync("./.env.local", "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = parseEnv();
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SR_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";

const DEFAULT_ACCENT = "#10b981";
const FALLBACK_LOGO_URL = "https://aswallet.fr/icon.svg";

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const client = await auth.getClient();

// 1. Fetch all cards from Supabase
const sbRes = await fetch(`${SB_URL}/rest/v1/cards?select=id,name,reward_text,design,businesses(name,logo_url)&status=not.eq.archived`, {
  headers: { apikey: SR_KEY, Authorization: `Bearer ${SR_KEY}` },
});
const cards = await sbRes.json();
console.log(`Found ${cards.length} active card(s) in Supabase\n`);

let created = 0;
let existed = 0;
let failed = 0;

for (const card of cards) {
  const classId = `${ISSUER_ID}.card-${card.id}`;
  const design = card.design ?? {};
  const bg = design.accent_color || DEFAULT_ACCENT;
  const logoUrl = design.logo_url ?? card.businesses?.logo_url ?? FALLBACK_LOGO_URL;
  const bannerUrl = design.banner_url ?? null;
  const issuerName = card.businesses?.name ?? "Commerce";
  const programName = card.name ?? "Carte de fidelite";

  // GET first
  try {
    await client.request({ url: `${BASE_URL}/loyaltyClass/${classId}`, method: "GET" });
    console.log(`  [exists ] ${classId} -> ${programName}`);
    existed++;
    continue;
  } catch (e) {
    if (e?.response?.status !== 404) {
      console.log(`  [failed ] ${classId} GET error: ${JSON.stringify(e?.response?.data ?? e.message)}`);
      failed++;
      continue;
    }
  }

  // POST
  const body = {
    id: classId,
    issuerName,
    programName,
    hexBackgroundColor: bg,
    countryCode: "FR",
    reviewStatus: "UNDER_REVIEW",
    rewardsTier: "Standard",
    rewardsTierLabel: "Programme",
    accountIdLabel: "Client",
    accountNameLabel: "Nom",
    programDetails: card.reward_text ?? "",
    programLogo: {
      sourceUri: { uri: logoUrl },
      contentDescription: { defaultValue: { language: "fr", value: issuerName } },
    },
    ...(bannerUrl ? {
      heroImage: {
        sourceUri: { uri: bannerUrl },
        contentDescription: { defaultValue: { language: "fr", value: programName } },
      },
    } : {}),
  };

  try {
    const ins = await client.request({ url: `${BASE_URL}/loyaltyClass`, method: "POST", data: body });
    console.log(`  [created] ${classId} -> ${programName} (${ins.data.reviewStatus})`);
    created++;
  } catch (e) {
    console.log(`  [FAILED ] ${classId} POST error: ${JSON.stringify(e?.response?.data ?? e.message)}`);
    failed++;
  }
}

console.log(`\nDone. created=${created} existed=${existed} failed=${failed}`);
