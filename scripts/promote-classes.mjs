// Promote all loyalty classes of the issuer from DRAFT -> UNDER_REVIEW
// Run once after Google Wallet issuer approval to trigger review on existing classes.
// Usage: node scripts/promote-classes.mjs
import { GoogleAuth } from "google-auth-library";

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const client = await auth.getClient();

async function listAllClasses() {
  const all = [];
  let token = undefined;
  do {
    const q = new URLSearchParams({ issuerId: ISSUER_ID, maxResults: "100" });
    if (token) q.set("token", token);
    const res = await client.request({
      url: `${BASE_URL}/loyaltyClass?${q.toString()}`,
      method: "GET",
    });
    const data = res.data;
    if (data.resources) all.push(...data.resources);
    token = data.pagination?.nextPageToken;
  } while (token);
  return all;
}

async function patchClass(classId, reviewStatus) {
  await client.request({
    url: `${BASE_URL}/loyaltyClass/${classId}`,
    method: "PATCH",
    data: { reviewStatus },
  });
}

const classes = await listAllClasses();
console.log(`Found ${classes.length} class(es) for issuer ${ISSUER_ID}\n`);

if (classes.length === 0) {
  console.log("Nothing to promote.");
  process.exit(0);
}

let promoted = 0;
let skipped = 0;
let failed = 0;

for (const c of classes) {
  const status = (c.reviewStatus ?? "UNKNOWN").toUpperCase();
  const line = `  ${c.id.padEnd(55)} ${status}`;
  if (status === "DRAFT") {
    try {
      await patchClass(c.id, "UNDER_REVIEW");
      console.log(`${line} -> UNDER_REVIEW ok`);
      promoted++;
    } catch (e) {
      console.log(`${line} -> FAILED: ${e?.response?.data?.error?.message ?? e.message}`);
      failed++;
    }
  } else {
    console.log(`${line} (skipped, already ${status})`);
    skipped++;
  }
}

console.log(`\nDone. promoted=${promoted} skipped=${skipped} failed=${failed}`);
