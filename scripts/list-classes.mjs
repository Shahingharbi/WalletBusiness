// List all loyalty classes of the issuer with their reviewStatus.
// Useful to see if a card-{id} class was persisted with wrong state.
// Usage: node scripts/list-classes.mjs
import { GoogleAuth } from "google-auth-library";

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const BASE_URL = "https://walletobjects.googleapis.com/walletobjects/v1";

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const client = await auth.getClient();

const all = [];
let token = undefined;
do {
  const q = new URLSearchParams({ issuerId: ISSUER_ID, maxResults: "100" });
  if (token) q.set("token", token);
  const res = await client.request({
    url: `${BASE_URL}/loyaltyClass?${q.toString()}`,
    method: "GET",
  });
  if (res.data.resources) all.push(...res.data.resources);
  token = res.data.pagination?.nextPageToken;
} while (token);

console.log(`Found ${all.length} class(es)\n`);
for (const c of all) {
  console.log(`  ${c.id}`);
  console.log(`    reviewStatus: ${c.reviewStatus}`);
  console.log(`    programName : ${c.programName ?? c.localizedProgramName?.defaultValue?.value ?? '?'}`);
  console.log(`    issuerName  : ${c.issuerName ?? c.localizedIssuerName?.defaultValue?.value ?? '?'}`);
}
