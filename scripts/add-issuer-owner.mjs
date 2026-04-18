import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "node:fs";

const KEY_FILE = "./google-wallet-key.json";
const ISSUER_ID = "3388000000023104053";
const NEW_OWNER_EMAIL = process.argv[2] || "shahingharbi64@gmail.com";

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});

const client = await auth.getClient();
const keyData = JSON.parse(readFileSync(KEY_FILE, "utf-8"));
console.log("Service account:", keyData.client_email);
console.log("Issuer ID:", ISSUER_ID);
console.log("Adding as OWNER:", NEW_OWNER_EMAIL);
console.log("");

const baseUrl = "https://walletobjects.googleapis.com/walletobjects/v1";

// 1) GET current permissions
let current = { permissions: [] };
try {
  const res = await client.request({
    url: `${baseUrl}/permissions/${ISSUER_ID}`,
    method: "GET",
  });
  current = res.data;
  console.log("Current permissions:", JSON.stringify(current.permissions ?? [], null, 2));
} catch (e) {
  console.log("No existing permissions yet (or error):", e?.response?.data ?? e.message);
}

// 2) Build new permissions list (preserve existing, add new owner if missing)
const existing = current.permissions ?? [];
const alreadyExists = existing.find(
  (p) => p.emailAddress?.toLowerCase() === NEW_OWNER_EMAIL.toLowerCase()
);

let newPerms;
if (alreadyExists) {
  console.log(`\n${NEW_OWNER_EMAIL} already has role: ${alreadyExists.role}`);
  if (alreadyExists.role === "OWNER") {
    console.log("Already OWNER, nothing to do.");
    process.exit(0);
  }
  newPerms = existing.map((p) =>
    p.emailAddress?.toLowerCase() === NEW_OWNER_EMAIL.toLowerCase()
      ? { ...p, role: "OWNER" }
      : p
  );
} else {
  newPerms = [
    ...existing,
    { emailAddress: NEW_OWNER_EMAIL, role: "OWNER" },
  ];
}

// 3) PUT updated permissions
const putBody = {
  issuerId: ISSUER_ID,
  permissions: newPerms,
};

const putRes = await client.request({
  url: `${baseUrl}/permissions/${ISSUER_ID}`,
  method: "PUT",
  data: putBody,
});

console.log("\nUpdated permissions:");
console.log(JSON.stringify(putRes.data, null, 2));
console.log(`\nDone. ${NEW_OWNER_EMAIL} is now OWNER on issuer ${ISSUER_ID}.`);
